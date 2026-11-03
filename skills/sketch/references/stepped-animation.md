# 交互分步动画

Pattern for one finite autoplay. Replace the diagram markers in [template.md](./template.md). Keep that file's variable block. Colors come from `var(--board-*)`.

The stage is a fixed 16:9 box, so the frame size is the finished picture on first paint. Steps sit in that box at `opacity: 0` until their tick. The timer shows each step and then stops. The last step stays.

## Layout

Actors stay visible. Each step is one arrow plus one caption. `data-step` matches a name in the script list.

```html
<style>
  .diagram {
    box-sizing: border-box;
    width: 960px;
    height: 540px;
    overflow: hidden;
    padding: 36px 48px;
    color: var(--board-ink);
    background: var(--board-fill);
    font: 16px/1.4 system-ui, sans-serif;
  }
  .actors, .step {
    display: grid;
    grid-template-columns: 140px 1fr 140px;
    align-items: center;
    gap: 12px;
  }
  .actor {
    text-align: center;
    padding: 10px 8px;
    border: 1px solid var(--board-ink);
    background: var(--board-ground);
  }
  .timeline { margin-top: 28px; }
  .step {
    min-height: 64px;
    opacity: 0;
    transform: translateY(8px);
    transition: opacity 320ms linear, transform 320ms linear;
  }
  .step.is-on { opacity: 1; transform: none; }
  .arrow { height: 2px; background: var(--board-brand); position: relative; }
  .arrow[data-dir="right"]::after,
  .arrow[data-dir="left"]::after {
    content: "";
    position: absolute;
    top: -4px;
    border: 5px solid transparent;
  }
  .arrow[data-dir="right"]::after { right: 0; border-left-color: var(--board-brand); }
  .arrow[data-dir="left"]::after { left: 0; border-right-color: var(--board-brand); }
  .caption { grid-column: 1 / -1; font-size: 14px; }
</style>
<div class="diagram">
  <div class="actors">
    <div class="actor">Browser</div>
    <div></div>
    <div class="actor">Server</div>
  </div>
  <div class="timeline">
    <div class="step" data-step="request">
      <span></span>
      <span class="arrow" data-dir="right"></span>
      <span></span>
      <span class="caption">1 · Browser → Server · request</span>
    </div>
    <div class="step" data-step="reply">
      <span></span>
      <span class="arrow" data-dir="left"></span>
      <span></span>
      <span class="caption">2 · Server → Browser · reply</span>
    </div>
    <div class="step" data-step="done">
      <span></span>
      <span class="arrow" data-dir="right"></span>
      <span></span>
      <span class="caption">3 · Browser → Server · done</span>
    </div>
  </div>
</div>
```

## Reveal

One chain. `next` adds `is-on` and schedules another tick only while names remain. The last call does not schedule.

```html
<script>
(function () {
  var order = ["request", "reply", "done"];
  var gap = 900;
  var i = 0;
  function next() {
    var el = document.querySelector('.step[data-step="' + order[i] + '"]');
    if (el) el.classList.add("is-on");
    i += 1;
    if (i < order.length) setTimeout(next, gap);
  }
  setTimeout(next, 400);
})();
</script>
```

Rename `order` and the captions for the protocol. Keep the chain finite: no `setInterval`, no `requestAnimationFrame` loop, no network.
