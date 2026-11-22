const boothUsage = (() => {
  const { api, analysisPath, byId, canUseAdmin, hasAdminToken, setAdminToken, clearAdminToken, showError } = boothApi;

  function validUsage(value) {
    const count = (number) => Number.isSafeInteger(number) && number >= 0;
    return value && typeof value.is_admin === "boolean" && count(value.used) && count(value.remaining)
      && (value.is_admin ? value.limit === null : count(value.limit) && value.remaining <= Math.max(0, value.limit - value.used));
  }

  function init(id, { demo = false, onChange } = {}) {
    const card = byId("try-on-usage");
    const progress = byId("usage-progress");
    const retry = byId("retry-usage");
    const adminPanel = byId("admin-panel");
    const adminForm = byId("admin-form");
    const tokenInput = byId("admin-token");
    const login = byId("admin-login");
    const logout = byId("admin-logout");
    let usage = null;
    let loading = false;
    let busy = false;
    let version = 0;
    let pending;
    let disposed = false;
    const number = (value) => value.toLocaleString("ko-KR");
    const ready = () => !disposed && !busy && !loading && usage !== null && usage.remaining > 0;

    function render() {
      const admin = usage?.is_admin === true;
      card.dataset.mode = admin ? "admin" : "participant";
      card.setAttribute("aria-busy", String(loading));
      byId("usage-mode").textContent = admin ? "관리자 모드" : "일반 참가자";
      byId("usage-heading").textContent = admin ? "개별 체험 제한" : "남은 체험 횟수";
      byId("usage-count").textContent = loading ? "확인 중" : !usage ? "확인 필요" : admin ? "무제한" : number(usage.remaining) + " / " + number(usage.limit) + "회";
      progress.hidden = !usage || admin || loading;
      if (usage && !admin) {
        progress.max = Math.max(1, usage.limit);
        progress.value = usage.remaining;
        progress.setAttribute("aria-valuetext", usage.remaining + "회 남음, 한도 " + usage.limit + "회");
      }
      byId("usage-total").hidden = !usage || !admin || loading;
      byId("usage-total").textContent = admin ? "전체 잔여 횟수: " + number(usage.remaining) + "회" : "";
      const message = demo ? "미리보기에서는 실제 체험 횟수가 차감되지 않아요."
        : loading ? "남은 체험 횟수를 확인하고 있어요."
        : usage?.remaining === 0 ? admin || usage.used < usage.limit
          ? "행사 전체 체험이 마감됐어요. 운영자에게 문의해 주세요."
          : "체험 가능한 횟수를 모두 사용했어요."
        : "";
      byId("usage-status").textContent = message;
      byId("usage-status").hidden = !message;
      retry.hidden = demo || loading || (usage !== null && usage.remaining > 0);
      retry.disabled = busy || loading;
      tokenInput.disabled = busy || loading || !canUseAdmin();
      login.disabled = busy || loading || !canUseAdmin();
      logout.hidden = !hasAdminToken();
      logout.disabled = busy || loading;
      if (onChange) onChange(ready());
    }

    async function refresh({ authenticating = false } = {}) {
      if (disposed) return false;
      if (demo) {
        usage = { is_admin: false, limit: 20, used: 0, remaining: 20 };
        render();
        return true;
      }
      const current = ++version;
      pending?.abort();
      pending = new AbortController();
      loading = true;
      usage = null;
      showError(byId("usage-error"));
      render();
      try {
        const data = await api(analysisPath(id) + "/try-on-usage", { useAdmin: true, signal: pending.signal });
        if (current !== version || disposed) return false;
        if (!validUsage(data)) throw new Error("남은 체험 횟수를 확인하지 못했어요. 다시 확인해 주세요.");
        usage = data;
        if (!data.is_admin && hasAdminToken()) {
          clearAdminToken();
          byId("admin-status").textContent = "";
          showError(byId("admin-error"), "관리자 인증에 실패했어요. 토큰을 확인해 주세요.");
        } else if (data.is_admin) {
          byId("admin-status").textContent = "관리자 인증이 완료됐어요. 전체 잔여 횟수 안에서 체험할 수 있어요.";
        }
        return true;
      } catch (cause) {
        if (current !== version || disposed) return false;
        if (authenticating) clearAdminToken();
        showError(byId("usage-error"), cause.message);
        return false;
      } finally {
        if (current === version && !disposed) {
          loading = false;
          render();
        }
      }
    }

    adminPanel.hidden = demo;
    byId("admin-security").textContent = canUseAdmin()
      ? "운영자만 인증해 주세요. 토큰은 현재 화면에서만 사용되며 새로고침하거나 화면을 떠나면 삭제돼요."
      : "관리자 인증은 HTTPS로 연결된 행사 사이트에서 사용할 수 있어요. 일반 참가자 체험은 그대로 이용할 수 있어요.";
    adminForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (busy || loading || demo) return;
      showError(byId("admin-error"));
      byId("admin-status").textContent = "";
      try {
        setAdminToken(tokenInput.value);
      } catch (cause) {
        showError(byId("admin-error"), cause.message);
        return;
      } finally {
        tokenInput.value = "";
      }
      byId("admin-status").textContent = "관리자 권한을 확인하고 있어요.";
      const completed = await refresh({ authenticating: true });
      if (!completed) byId("admin-status").textContent = "";
    });
    logout.addEventListener("click", () => {
      if (busy || loading) return;
      clearAdminToken();
      tokenInput.value = "";
      showError(byId("admin-error"));
      byId("admin-status").textContent = "일반 참가자로 전환했어요.";
      refresh();
    });
    retry.addEventListener("click", () => refresh());
    window.addEventListener("pagehide", () => {
      disposed = true;
      version++;
      pending?.abort();
      tokenInput.value = "";
      usage = null;
      render();
    });
    window.addEventListener("pageshow", (event) => {
      if (event.persisted) {
        disposed = false;
        byId("admin-status").textContent = "";
        showError(byId("admin-error"));
        refresh();
      }
    });
    refresh();
    return {
      get canApply() { return ready(); },
      refresh,
      setBusy(value) { busy = value; render(); },
    };
  }

  return { init };
})();
