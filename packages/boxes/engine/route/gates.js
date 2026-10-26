/* BoxesRoute gates: k-selection vetoes only. Arrow min is drawing, not a veto. */
  function copyCandidate(candidate) {
    return {
      source: candidate.source,
      target: candidate.target,
      points: candidate.points,
      folds: candidate.folds,
      length: candidate.length,
    };
  }

  // Collision / 贴边 thresholds live in world.pathHits(folds). This list is
  // only for later k-gates. Last-run 24/36 must not be appended here.
  const VETOES = [];

  function veto(candidate, obstacles) {
    const state = copyCandidate(candidate);
    const ctx = { obstacles: obstacles || [] };
    for (let index = 0; index < VETOES.length; index += 1) {
      const reason = VETOES[index](state, ctx);
      if (reason) return reason;
    }
    return null;
  }

  function admit(candidate, obstacles) {
    const state = copyCandidate(candidate);
    const ctx = { obstacles: obstacles || [] };
    for (let index = 0; index < VETOES.length; index += 1) {
      if (VETOES[index](state, ctx)) return null;
    }
    return state;
  }

  function admitBatch(batch, obstacles) {
    const out = [];
    (batch || []).forEach((candidate) => {
      const allowed = admit(candidate, obstacles);
      if (allowed) out.push(allowed);
    });
    return out;
  }

export { VETOES, veto, admit, admitBatch }
