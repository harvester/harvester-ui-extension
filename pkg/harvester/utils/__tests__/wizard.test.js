import { preventImplicitSubmit } from '../wizard';

function keydown(target) {
  return { target, preventDefault: jest.fn() };
}

describe('preventImplicitSubmit', () => {
  it('should stop Enter in a text field from submitting the wizard', () => {
    const event = keydown(document.createElement('input'));

    preventImplicitSubmit(event);

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
  });

  it('should leave Enter in a dropdown alone, which uses it to pick an option', () => {
    const select = document.createElement('div');
    const input = document.createElement('input');

    select.className = 'v-select';
    select.appendChild(input);

    const event = keydown(input);

    preventImplicitSubmit(event);

    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it.each(['textarea', 'button'])('should leave Enter on a %s alone', (tag) => {
    const event = keydown(document.createElement(tag));

    preventImplicitSubmit(event);

    expect(event.preventDefault).not.toHaveBeenCalled();
  });
});
