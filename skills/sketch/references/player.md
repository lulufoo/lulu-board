# Player

Use this self-contained content template inside the `.diagram` from [template.md](./template.md). Keep the theme variables from that template. Set `duration` in milliseconds and implement `render(progress)` for the content. Progress runs from `0` to `1`; call it the same way for playback and seeking. The example content can be replaced with any content.

The player starts paused. Playback advances the timeline, pause holds it, and a timeline click or drag seeks without changing the play/pause state. At the end it stops; pressing play starts again at the beginning. In Board, select **Present** and close the dock to interact with the player.

```html
<style>
  .diagram {
    width: 1600px;
    height: 900px;
    padding: 32px 56px 28px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    color: var(--board-ink);
    font-family: Inter, "PingFang SC", "Microsoft YaHei", sans-serif;
  }
  .diagram *, .diagram *::before { box-sizing: border-box; }
  .player-content { flex: 1; min-height: 0; }
  .player-controls { position: relative; flex: none; width: 100%; height: 96px; }
  .player-toggle {
    position: absolute;
    top: 0;
    right: 0;
    width: 84px;
    height: 56px;
    border: 0;
    border-radius: 18px;
    padding: 0;
    display: grid;
    place-items: center;
    background: color-mix(in srgb, var(--board-brand) 10%, transparent);
    cursor: pointer;
  }
  .player-toggle:focus-visible, .player-seek:focus-visible {
    outline: 3px solid var(--board-brand);
    outline-offset: 3px;
  }
  .player-toggle svg { width: 36px; height: 36px; }
  .player-toggle .pause-icon, .player-toggle[data-playing="true"] .play-icon { display: none; }
  .player-toggle[data-playing="true"] .pause-icon { display: block; }
  .player-seek {
    position: absolute;
    left: 0;
    right: 0;
    top: 64px;
    height: 32px;
    cursor: pointer;
    touch-action: none;
  }
  .player-rail, .player-progress {
    position: absolute;
    left: 0;
    top: 12px;
    width: 100%;
    height: 7px;
    border-radius: 10px;
    background: var(--board-brand);
    pointer-events: none;
  }
  .player-rail { opacity: .45; }
  .player-progress { transform: scaleX(0); transform-origin: left; }
  .player-thumb {
    position: absolute;
    left: 0;
    top: 7px;
    width: 100%;
    height: 17px;
    pointer-events: none;
  }
  .player-thumb::before {
    content: "";
    position: absolute;
    width: 17px;
    height: 17px;
    border-radius: 50%;
    background: var(--board-brand);
    transform: translateX(-50%);
  }
</style>

<div class="player-content"></div>
<div class="player-controls">
  <button class="player-toggle" type="button" aria-label="Play" data-playing="false">
    <svg class="play-icon" viewBox="0 0 48 48" aria-hidden="true"><path fill="#fff" d="M17 9 Q15 8 15 12 V36 Q15 40 18 39 L38 27 Q42 24 38 21 Z"/></svg>
    <svg class="pause-icon" viewBox="0 0 48 48" aria-hidden="true"><rect fill="#fff" x="12" y="10" width="8" height="28" rx="3"/><rect fill="#fff" x="28" y="10" width="8" height="28" rx="3"/></svg>
  </button>
  <div class="player-seek" role="slider" tabindex="0" aria-label="Playback progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
    <div class="player-rail"></div>
    <div class="player-progress"></div>
    <div class="player-thumb"></div>
  </div>
</div>
<script>
  (function () {
    var duration = 35000;
    var content = document.querySelector('.player-content');
    var button = document.querySelector('.player-toggle');
    var seek = document.querySelector('.player-seek');
    var bar = document.querySelector('.player-progress');
    var thumb = document.querySelector('.player-thumb');
    var progress = 0, playing = false, frame = 0, lastTime = 0;

    function render(progress) {
      // Replace this body with the content's response to progress.
    }

    function draw() {
      bar.style.transform = 'scaleX(' + progress + ')';
      thumb.style.transform = 'translateX(' + (progress * 100) + '%)';
      seek.setAttribute('aria-valuenow', String(Math.round(progress * 100)));
      button.dataset.playing = String(playing);
      button.setAttribute('aria-label', playing ? 'Pause' : 'Play');
      render(progress);
    }

    function tick(now) {
      if (!playing) return;
      progress = Math.min(1, progress + (now - lastTime) / duration);
      lastTime = now;
      if (progress === 1) playing = false;
      draw();
      frame = playing ? requestAnimationFrame(tick) : 0;
    }

    button.addEventListener('click', function () {
      if (playing) {
        playing = false;
        cancelAnimationFrame(frame);
        frame = 0;
      } else {
        if (progress === 1) progress = 0;
        playing = true;
        lastTime = performance.now();
        frame = requestAnimationFrame(tick);
      }
      draw();
    });

    function seekTo(value) {
      progress = Math.max(0, Math.min(1, value));
      if (playing) lastTime = performance.now();
      draw();
    }
    function seekAt(event) {
      var rect = seek.getBoundingClientRect();
      if (rect.width) seekTo((event.clientX - rect.left) / rect.width);
    }
    seek.addEventListener('pointerdown', function (event) {
      if (event.button !== 0) return;
      seek.setPointerCapture(event.pointerId);
      seekAt(event);
    });
    seek.addEventListener('pointermove', function (event) {
      if (seek.hasPointerCapture(event.pointerId)) seekAt(event);
    });
    seek.addEventListener('keydown', function (event) {
      var next = progress;
      if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next += .01;
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next -= .01;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = 1;
      else return;
      event.preventDefault();
      seekTo(next);
    });
    draw();
  })();
</script>
```
