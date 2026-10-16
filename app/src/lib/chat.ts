export const OPEN_ASSISTANT_EVENT = 'fedexr:open-assistant';

export function openAssistant() {
  window.dispatchEvent(new Event(OPEN_ASSISTANT_EVENT));
}
