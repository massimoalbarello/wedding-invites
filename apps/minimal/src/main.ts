import { createInvitationClient } from '@repo/invitation-runtime/client';
import { MAX_NAME_LENGTH, type RsvpState } from '@repo/invitation-runtime/contract';
import './styles.css';

const runtime = createInvitationClient({ window });
const form = document.querySelector<HTMLFormElement>('#reply')!;
const names = document.querySelector<HTMLDivElement>('#names')!;
const companions = document.querySelector<HTMLDivElement>('#companions')!;
const add = document.querySelector<HTMLButtonElement>('#add-guest')!;
const save = document.querySelector<HTMLButtonElement>('#save')!;
const error = document.querySelector<HTMLParagraphElement>('#error')!;
let state: RsvpState;

function syncControls() {
  const accepted = form.querySelector<HTMLInputElement>('input[value="accepted"]')!.checked;
  companions.hidden = !accepted || state.maxAdditionalGuests === 0;
  const fields = names.querySelectorAll<HTMLInputElement>('input');
  fields.forEach((field) => {
    field.required = accepted;
    field.disabled = !accepted;
  });
  add.hidden = fields.length >= state.maxAdditionalGuests;
}
function addCompanion(name = '') {
  const row = document.createElement('div');
  row.className = 'companion';
  const label = document.createElement('label');
  label.textContent = 'Guest name';
  const field = document.createElement('input');
  field.name = 'companion';
  field.value = name;
  field.maxLength = MAX_NAME_LENGTH;
  label.append(field);
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.textContent = 'Remove';
  remove.addEventListener('click', () => {
    row.remove();
    syncControls();
  });
  row.append(label, remove);
  names.append(row);
  syncControls();
}
function applyState(value: RsvpState) {
  state = value;
  form.querySelectorAll<HTMLInputElement>('input[name="status"]').forEach((field) => {
    field.checked = field.value === state.status;
  });
  names.replaceChildren();
  state.companions.forEach((name) => {
    addCompanion(name);
  });
  save.textContent = state.status === 'pending' ? 'Send reply' : 'Update reply';
  syncControls();
}
form.addEventListener('change', syncControls);
add.addEventListener('click', () => addCompanion());
form.addEventListener('submit', (event) => {
  event.preventDefault();
  void submit();
});
async function submit() {
  error.textContent = '';
  save.disabled = true;
  const data = new FormData(form);
  const status = data.get('status') === 'accepted' ? 'accepted' : 'declined';
  try {
    applyState(
      await runtime.saveRsvp({
        status,
        companions: status === 'accepted' ? data.getAll('companion').map(String) : [],
      }),
    );
    document.querySelector('#confirmation')!.textContent =
      status === 'accepted'
        ? 'Your reply is saved. We look forward to seeing you.'
        : 'Thank you for letting us know.';
  } catch (failure) {
    error.textContent =
      failure instanceof Error
        ? failure.message
        : 'Your reply could not be saved. Please try again.';
  } finally {
    save.disabled = false;
  }
}
try {
  const context = await runtime.getContext();
  document.querySelector('#greeting')!.textContent =
    `${context.recipient.name}, we hope you can be part of this special day.`;
  document.querySelector('#allowance')!.textContent =
    `You may bring up to ${context.rsvp.maxAdditionalGuests} additional guests.`;
  applyState(context.rsvp);
  form.hidden = false;
} catch (failure) {
  error.textContent =
    failure instanceof Error ? failure.message : 'This invitation could not be opened.';
}
