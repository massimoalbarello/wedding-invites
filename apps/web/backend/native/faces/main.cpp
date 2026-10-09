#include <opencv2/core.hpp>
#include <opencv2/dnn.hpp>
#include <opencv2/imgcodecs.hpp>
#include <opencv2/imgproc.hpp>
#include <opencv2/features2d.hpp>
#include <opencv2/objdetect.hpp>
#include <algorithm>
#include <cctype>
#include <cmath>
#include <iostream>
#include <stdexcept>
#include <string>
#include <vector>

namespace {
constexpr int kDetectorEdge = 640;
constexpr int kImageEdge = 1600;
constexpr int kFingerprintEdge = 32;
constexpr int kFeatureEdge = 256;
constexpr int kMaximumImageFeatures = 150;
constexpr int kMinimumFaceEdge = 48;
constexpr int kDimensions = 128;

cv::Mat detect(const cv::Mat& image, const cv::Ptr<cv::FaceDetectorYN>& detector) {
  cv::Mat small;
  const double scale = std::min(1., double(kDetectorEdge) / std::max(image.cols, image.rows));
  cv::resize(image, small, {}, scale, scale, cv::INTER_AREA);
  std::vector<cv::Mat> candidates;
  for (const int angle : {0, 90, -90, 180, 45, -45, 135, -135}) {
    const double radians = angle * CV_PI / 180.;
    const double width = std::abs(std::cos(radians)) * small.cols + std::abs(std::sin(radians)) * small.rows;
    const double height = std::abs(std::sin(radians)) * small.cols + std::abs(std::cos(radians)) * small.rows;
    const double fit = std::min(1., kDetectorEdge / std::max(width, height));
    const cv::Size size(int(std::ceil(width * fit)), int(std::ceil(height * fit)));
    cv::Mat transform = cv::getRotationMatrix2D({small.cols / 2.f, small.rows / 2.f}, angle, fit);
    transform.at<double>(0, 2) += (size.width - small.cols) / 2.;
    transform.at<double>(1, 2) += (size.height - small.rows) / 2.;
    cv::Mat rotated, inverse;
    cv::warpAffine(small, rotated, transform, size);
    cv::invertAffineTransform(transform, inverse);
    const auto original = [&](float x, float y) {
      return cv::Point2f(
        (inverse.at<double>(0, 0) * x + inverse.at<double>(0, 1) * y + inverse.at<double>(0, 2)) * image.cols / small.cols,
        (inverse.at<double>(1, 0) * x + inverse.at<double>(1, 1) * y + inverse.at<double>(1, 2)) * image.rows / small.rows);
    };
    detector->setInputSize(size);
    cv::Mat faces;
    detector->detect(rotated, faces);
    for (int i = 0; i < faces.rows; ++i) {
      cv::Mat face = faces.row(i).clone();
      const float x = face.at<float>(0), y = face.at<float>(1);
      const float w = face.at<float>(2), h = face.at<float>(3);
      const auto center = original(x + w / 2, y + h / 2);
      if (center.x < 0 || center.y < 0 || center.x >= image.cols || center.y >= image.rows) continue;
      float left = image.cols, top = image.rows, right = 0, bottom = 0;
      for (const auto& corner : {original(x, y), original(x + w, y), original(x, y + h), original(x + w, y + h)}) {
        left = std::min(left, corner.x); top = std::min(top, corner.y);
        right = std::max(right, corner.x); bottom = std::max(bottom, corner.y);
      }
      left = std::max(0.f, left); top = std::max(0.f, top);
      right = std::min(float(image.cols), right); bottom = std::min(float(image.rows), bottom);
      if (right <= left || bottom <= top) continue;
      face.at<float>(0) = left; face.at<float>(1) = top;
      face.at<float>(2) = right - left; face.at<float>(3) = bottom - top;
      for (int j = 4; j < 14; j += 2) {
        const auto point = original(face.at<float>(j), face.at<float>(j + 1));
        face.at<float>(j) = point.x; face.at<float>(j + 1) = point.y;
      }
      candidates.push_back(face);
    }
  }
  std::stable_sort(candidates.begin(), candidates.end(), [](const cv::Mat& a, const cv::Mat& b) {
    return a.at<float>(14) > b.at<float>(14);
  });
  cv::Mat result;
  std::vector<cv::Rect2f> accepted;
  for (const auto& face : candidates) {
    const cv::Rect2f box(face.at<float>(0), face.at<float>(1), face.at<float>(2), face.at<float>(3));
    const bool duplicate = std::any_of(accepted.begin(), accepted.end(), [&](const cv::Rect2f& other) {
      const float intersection = (box & other).area();
      return intersection / (box.area() + other.area() - intersection) > .35f;
    });
    if (!duplicate) { accepted.push_back(box); result.push_back(face); }
  }
  return result;
}

void analyze(const std::string& path, cv::FileStorage& output,
             const cv::Ptr<cv::FaceDetectorYN>& detector, const cv::Ptr<cv::FaceRecognizerSF>& recognizer) {
  // imread applies EXIF orientation before detection and alignment.
  cv::Mat image = cv::imread(path, cv::IMREAD_COLOR);
  if (image.empty()) throw std::runtime_error("invalid_image");
  const double scale = std::min(1., double(kImageEdge) / std::max(image.cols, image.rows));
  if (scale < 1) cv::resize(image, image, {}, scale, scale, cv::INTER_AREA);
  const auto faces = detect(image, detector);
  if (faces.rows == 0) throw std::runtime_error("no_face");
  if (faces.rows != 1) throw std::runtime_error("multiple_faces");
  const cv::Mat face = faces.row(0);
  if (std::min(face.at<float>(2), face.at<float>(3)) < kMinimumFaceEdge) {
    throw std::runtime_error("small_face");
  }
  cv::Mat aligned, vector, grey, thumbnail;
  recognizer->alignCrop(image, face, aligned);
  recognizer->feature(aligned, vector);
  if (vector.total() != kDimensions) throw std::runtime_error("invalid_embedding");
  cv::normalize(vector, vector);
  if (!cv::checkRange(vector)) throw std::runtime_error("invalid_embedding");
  cv::cvtColor(aligned, grey, cv::COLOR_BGR2GRAY);
  cv::resize(grey, thumbnail, {kFingerprintEdge, kFingerprintEdge}, 0, 0, cv::INTER_AREA);
  output << "embedding" << std::vector<float>(vector.ptr<float>(), vector.ptr<float>() + kDimensions);
  output << "pixels" << "[";
  for (int row = 0; row < thumbnail.rows; ++row) {
    for (int col = 0; col < thumbnail.cols; ++col) output << int(thumbnail.at<unsigned char>(row, col));
  }
  output << "]";
  const cv::Rect box(int(face.at<float>(0)), int(face.at<float>(1)),
                     std::max(1, int(face.at<float>(2))), std::max(1, int(face.at<float>(3))));
  cv::Mat portrait, mask, descriptors;
  cv::resize(image(box & cv::Rect(0, 0, image.cols, image.rows)), portrait, {kFeatureEdge, kFeatureEdge});
  cv::cvtColor(portrait, portrait, cv::COLOR_BGR2GRAY);
  mask = cv::Mat::zeros(portrait.size(), CV_8U);
  // Restrict texture features to the face, excluding matching backgrounds between fresh selfies.
  cv::ellipse(mask, {kFeatureEdge / 2, kFeatureEdge / 2}, {kFeatureEdge / 2 - 8, kFeatureEdge / 2 - 8},
              0, 0, 360, 255, -1);
  std::vector<cv::KeyPoint> keypoints;
  const auto features = cv::ORB::create(kMaximumImageFeatures);
  features->detectAndCompute(portrait, mask, keypoints, descriptors);
  output << "descriptors" << "[";
  for (int row = 0; row < descriptors.rows; ++row) {
    for (int col = 0; col < descriptors.cols; ++col) output << int(descriptors.at<unsigned char>(row, col));
  }
  output << "]";
}
}

int main(int argc, char** argv) {
  if (argc != 4) return 2;
  try {
    cv::setNumThreads(1);
    const auto detector = cv::FaceDetectorYN::create(argv[1], "", {kDetectorEdge, kDetectorEdge}, .85f);
    const auto recognizer = cv::FaceRecognizerSF::create(argv[2], "");
    cv::FileStorage result("", cv::FileStorage::WRITE | cv::FileStorage::MEMORY | cv::FileStorage::FORMAT_JSON);
    try {
      analyze(argv[3], result, detector, recognizer);
    } catch (const std::runtime_error& error) {
      result << "error" << error.what();
    } catch (const cv::Exception&) {
      result << "error" << "invalid_image";
    }
    std::string json = result.releaseAndGetString();
    json.erase(std::remove_if(json.begin(), json.end(), [](unsigned char c) { return std::isspace(c); }), json.end());
    std::cout << json << std::endl;
  } catch (const std::exception&) {
    std::cerr << "Face models could not be loaded" << std::endl;
    return 1;
  }
}
