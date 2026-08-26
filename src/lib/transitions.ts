/** Transitions.dev helpers — reflow, shake, text-swap, tabs pill */

export function forceReflow(el: HTMLElement | null) {
  if (!el) return;
  void el.offsetWidth;
}

/** Trigger error shake on a .t-input inside .t-input-wrap */
export function triggerInputError(wrap: HTMLElement | null, holdMs = 3000) {
  if (!wrap) return;
  const input = wrap.querySelector(".t-input") as HTMLElement | null;
  wrap.classList.add("is-error");
  input?.classList.add("is-error");
  if (input) {
    input.classList.remove("is-shaking");
    forceReflow(input);
    input.classList.add("is-shaking");
  }
  window.setTimeout(() => {
    wrap.classList.remove("is-error");
    input?.classList.remove("is-error", "is-shaking");
  }, holdMs);
}

/** Three-phase text swap on .t-text-swap */
export async function swapText(
  el: HTMLElement | null,
  next: string,
  durMs = 150,
) {
  if (!el) return;
  el.classList.add("is-exit");
  await new Promise((r) => setTimeout(r, durMs));
  el.textContent = next;
  el.classList.remove("is-exit");
  el.classList.add("is-enter-start");
  forceReflow(el);
  el.classList.remove("is-enter-start");
}

/** Position sliding tabs pill under the active tab */
export function syncTabsPill(
  tabsRoot: HTMLElement | null,
  animate = true,
) {
  if (!tabsRoot) return;
  const pill = tabsRoot.querySelector(".t-tabs-pill") as HTMLElement | null;
  const active = tabsRoot.querySelector(
    '.t-tab[aria-selected="true"]',
  ) as HTMLElement | null;
  if (!pill || !active) return;
  if (!animate) {
    pill.style.transition = "none";
  }
  pill.style.transform = `translateX(${active.offsetLeft}px)`;
  pill.style.width = `${active.offsetWidth}px`;
  if (!animate) {
    forceReflow(pill);
    pill.style.transition = "";
  }
}

/** Seed particle CSS vars for like burst */
export function seedLikeParticles(btn: HTMLElement | null) {
  if (!btn) return;
  const dots = btn.querySelectorAll(".t-like-particles i");
  const dist = 20;
  dots.forEach((dot, i) => {
    const angle = (Math.PI * 2 * i) / dots.length + (Math.random() - 0.5) * 0.4;
    const d = dist * (0.7 + Math.random() * 0.5);
    const el = dot as HTMLElement;
    el.style.setProperty("--px", `${Math.cos(angle) * d}px`);
    el.style.setProperty("--py", `${Math.sin(angle) * d}px`);
    el.style.setProperty("--pdur", `${500 + Math.random() * 200}ms`);
    el.style.setProperty("--pdelay", `${Math.random() * 40}ms`);
    el.style.setProperty("--p-end-scale", `${0.4 + Math.random() * 0.4}`);
    el.style.setProperty("--psize", `${0.7 + Math.random() * 0.6}`);
  });
}
