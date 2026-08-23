export class TextBuffer {
  constructor(text = '') {
    if (typeof text !== 'string') throw new TypeError('TextBuffer content must be a string.');
    this.text = text;
    this.caret = text.length;
  }

  insert(value) {
    if (typeof value !== 'string' || !value.length) throw new TypeError('Inserted text must be a non-empty string.');
    this.text = `${this.text.slice(0, this.caret)}${value}${this.text.slice(this.caret)}`;
    this.caret += value.length;
    return this;
  }

  enter() { return this.insert('\n'); }

  backspace() {
    if (this.caret === 0) return this;
    this.text = `${this.text.slice(0, this.caret - 1)}${this.text.slice(this.caret)}`;
    this.caret -= 1;
    return this;
  }

  delete() {
    if (this.caret >= this.text.length) return this;
    this.text = `${this.text.slice(0, this.caret)}${this.text.slice(this.caret + 1)}`;
    return this;
  }

  left() {
    this.caret = Math.max(0, this.caret - 1);
    return this;
  }

  right() {
    this.caret = Math.min(this.text.length, this.caret + 1);
    return this;
  }

  home() {
    const previousBreak = this.text.lastIndexOf('\n', Math.max(0, this.caret - 1));
    this.caret = previousBreak + 1;
    return this;
  }

  end() {
    const nextBreak = this.text.indexOf('\n', this.caret);
    this.caret = nextBreak === -1 ? this.text.length : nextBreak;
    return this;
  }

  clear() {
    this.text = '';
    this.caret = 0;
    return this;
  }

  get lines() { return this.text.split('\n'); }
  get lineCount() { return this.lines.length; }
  get characterCount() { return this.text.length; }

  get caretPosition() {
    const before = this.text.slice(0, this.caret);
    const lines = before.split('\n');
    return { line: lines.length - 1, column: lines.at(-1).length };
  }

  snapshot() {
    return {
      text: this.text,
      caret: this.caret,
      caretPosition: this.caretPosition,
      characterCount: this.characterCount,
      lineCount: this.lineCount
    };
  }
}
