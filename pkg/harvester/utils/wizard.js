/**
 * Keydown (capture) handler for a wizard. The shell's Wizard renders its step headers as buttons without a type
 * since 3.0.14, so they are submit buttons: Enter in a text field submits the form by clicking the first one,
 * which jumps back to step 1. Dropdowns are left alone, they use Enter to pick an option.
 */
export function preventImplicitSubmit(event) {
  const target = event?.target;

  if (target?.tagName === 'INPUT' && !target.closest('.v-select')) {
    event.preventDefault();
  }
}
