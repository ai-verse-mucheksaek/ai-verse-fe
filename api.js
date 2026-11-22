const boothApi = (() => {
  const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
  const filePreview = location.protocol === "file:";
  const apiOrigin = filePreview || (loopbackHosts.has(location.hostname) && ["5173", "3000"].includes(location.port))
    ? "http://localhost:8000"
    : location.origin;
  const analysisKey = "ai-verse-analysis";
  const analysisExpiryKey = "ai-verse-analysis-expiry";
  let adminToken = "";
  const canUseAdmin = () => location.protocol === "https:" && new URL(apiOrigin).protocol === "https:";
  const hasAdminToken = () => Boolean(adminToken);
  const clearAdminToken = () => { adminToken = ""; };
  function setAdminToken(value) {
    if (!canUseAdmin()) throw new Error("관리자 인증은 HTTPS 연결에서만 사용할 수 있어요.");
    const token = typeof value === "string" ? value.trim() : "";
    if (!token || token.length > 2048 || /[^\x21-\x7e]/.test(token)) throw new Error("관리자 토큰을 확인해 주세요.");
    adminToken = token;
  }
  window.addEventListener("pagehide", clearAdminToken);

  const byId = (id) => document.getElementById(id);
  const isLocalAddress = (url) => url.protocol === "file:" || loopbackHosts.has(url.hostname);
  const currentAnalysis = () => filePreview ? null : sessionStorage.getItem(analysisKey);
  const currentAnalysisExpiry = () => filePreview ? null : sessionStorage.getItem(analysisExpiryKey);
  function setAnalysis(id, expiresAt) {
    sessionStorage.setItem(analysisKey, id);
    if (expiresAt) sessionStorage.setItem(analysisExpiryKey, expiresAt);
    else sessionStorage.removeItem(analysisExpiryKey);
  }
  function clearAnalysis() {
    clearAdminToken();
    if (filePreview) return;
    sessionStorage.removeItem(analysisKey);
    sessionStorage.removeItem(analysisExpiryKey);
  }
  const analysisPath = (id) => "/api/v1/analyses/" + encodeURIComponent(id);

  function apiUrl(path) {
    const url = new URL(path, apiOrigin);
    if (url.origin !== apiOrigin) throw new Error("결과 주소를 열 수 없어요.");
    return url.href;
  }

  async function api(path, { signal, timeoutMs = 15_000, useAdmin = false, ...options } = {}) {
    if (filePreview) throw new Error("실제 분석은 프론트 서버를 켜고 브라우저에서 열어 주세요.");
    const url = apiUrl(path);
    const headers = new Headers(options.headers);
    if (useAdmin && adminToken) headers.set("X-Admin-Token", adminToken);
    const authenticated = headers.has("X-Admin-Token");
    if (authenticated && (!canUseAdmin() || !(path === "/api/v1/try-ons" || /^\/api\/v1\/analyses\/[^/]+\/try-on-usage$/.test(path)))) {
      throw new Error("관리자 토큰은 HTTPS의 체험 횟수 조회와 메이크업 요청에만 사용할 수 있어요.");
    }
    const request = new AbortController();
    const abort = () => request.abort(signal.reason);
    if (signal?.aborted) throw signal.reason;
    signal?.addEventListener("abort", abort, { once: true });
    const timer = window.setTimeout(() => request.abort(), timeoutMs);
    let response;
    let data;
    try {
      response = await fetch(url, { ...options, headers, signal: request.signal, cache: "no-store", ...(authenticated ? { redirect: "error" } : {}) });
      data = response.status === 204 ? null : await response.json().catch((error) => {
        if (request.signal.aborted) throw error;
        return null;
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      if (request.signal.aborted) throw new Error("서버 응답이 늦어요. 잠시 뒤 다시 시도해 주세요.");
      throw new Error("분석 서버에 연결할 수 없어요. 연결을 확인하고 다시 시도해 주세요.");
    } finally {
      window.clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }

    if (response.ok && (response.status === 204 || data !== null)) return data;

    const messages = {
      404: "결과가 없거나 보관 시간이 끝났어요.",
      429: "요청이 많아요. 잠시 뒤 다시 시도해 주세요.",
    };
    if (path === "/api/v1/try-ons") messages[502] = "가상 메이크업을 적용할 수 없어요. 잠시 뒤 다시 시도해 주세요.";
    const detail = response.status < 500 && typeof data?.detail === "string" ? data.detail : "";
    const error = new Error(path === "/health"
      ? "분석 서버 상태를 확인하지 못했어요. 연결을 확인하고 다시 시도해 주세요."
      : (response.status === 429 && detail) || messages[response.status] || detail || "요청을 완료할 수 없어요. 다시 시도해 주세요.");
    error.status = response.status;
    throw error;
  }

  function showError(element, message = "") {
    element.textContent = message;
    element.hidden = !message;
  }

  return { byId, isLocalAddress, currentAnalysis, currentAnalysisExpiry, setAnalysis, clearAnalysis, analysisPath, apiUrl, api, showError, canUseAdmin, hasAdminToken, setAdminToken, clearAdminToken };
})();
