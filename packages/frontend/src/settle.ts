/** Two quiet windows, total 1.8 s. Pointer-down/text editing explicitly suspends the clock. */
export class StrokeSettler {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private candidate = '';
  private lastSent = '';
  private generation = 0;
  constructor(private readonly onStable: () => void, private readonly windowMs = 900) {}
  update(fingerprint: string, eligible: boolean) {
    this.cancel();
    if (!eligible || !fingerprint || fingerprint === this.lastSent) return;
    this.candidate = fingerprint;
    const generation = this.generation;
    this.timer = setTimeout(() => {
      if (generation !== this.generation || fingerprint !== this.candidate) return;
      this.timer = setTimeout(() => {
        if (generation !== this.generation) return;
        this.lastSent = fingerprint;
        this.onStable();
      }, this.windowMs);
    }, this.windowMs);
  }
  cancel() { clearTimeout(this.timer); this.generation++; }
}
