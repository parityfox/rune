/**
 * Wire a panel button. The action runs on click, which Enter and Space also
 * dispatch, so it works from the keyboard. mousedown only stops the press from
 * moving focus and losing the editor's selection.
 */
export function onActivate(button, action) {
  button.addEventListener('mousedown', (e) => e.preventDefault());
  button.addEventListener('click', action);
}
