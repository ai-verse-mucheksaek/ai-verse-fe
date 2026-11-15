const boothCapture = (() => {
  const { api, byId, clearAnalysis, setAnalysis, showError } = boothApi;

  function initCapture() {
    clearAnalysis();
    const video = byId("camera-video");
    const photo = byId("captured-photo");
    const guide = byId("camera-guide");
    const placeholder = byId("camera-placeholder");
    const countdown = byId("countdown");
    const open = byId("open-camera");
    const choose = byId("choose-photo");
    const fileInput = byId("photo-file");
    const sourceNote = byId("photo-source");
    const take = byId("take-photo");
    const retake = byId("retake-photo");
    const analyze = byId("analyze-photo");
    const status = byId("capture-status");
    const error = byId("capture-error");
    const consent = byId("photo-consent");
    const lifecycle = new AbortController();
    let stream;
    let frame;
    let filename = "capture.jpg";
    let previewUrl;
    let timer;
    let sourceVersion = 0;
    let working = false;

    const isCurrent = (version) => !lifecycle.signal.aborted && consent.checked && version === sourceVersion;
    function setWorking(value) {
      working = value;
      [open, choose, fileInput, retake, analyze].forEach((element) => { element.disabled = value; });
      take.disabled = value || Boolean(timer);
    }
    function hasConsent() {
      if (consent.checked) return true;
      showError(error, "촬영·사진 선택 안내를 확인하고 동의 항목을 체크해 주세요.");
      consent.focus();
      return false;
    }
    function cancelCountdown() {
      window.clearInterval(timer);
      timer = undefined;
      countdown.hidden = true;
      take.disabled = working;
    }
    function stopCamera() {
      stream?.getTracks().forEach((track) => track.stop());
      stream = undefined;
      video.srcObject = null;
    }
    function clearPreview() {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = undefined;
      frame = undefined;
      filename = "capture.jpg";
      photo.removeAttribute("src");
      photo.hidden = true;
      sourceNote.textContent = "";
    }
    function showPhoto(blob, name, note) {
      clearPreview();
      frame = blob;
      filename = name;
      previewUrl = URL.createObjectURL(frame);
      photo.src = previewUrl;
      photo.hidden = false;
      video.hidden = guide.hidden = take.hidden = true;
      retake.hidden = analyze.hidden = false;
      open.hidden = true;
      placeholder.hidden = true;
      sourceNote.textContent = note;
      status.textContent = "사진이 잘 나왔는지 확인해 주세요.";
      analyze.focus();
    }
    function resetView() {
      cancelCountdown();
      stopCamera();
      clearPreview();
      fileInput.value = "";
      video.hidden = guide.hidden = take.hidden = retake.hidden = analyze.hidden = true;
      placeholder.hidden = false;
      open.hidden = false;
    }

    async function openCamera() {
      if (working || !hasConsent()) return;
      const version = ++sourceVersion;
      cancelCountdown();
      stopCamera();
      showError(error);
      setWorking(true);
      status.textContent = "분석 서버 연결을 확인하는 중이에요.";
      try {
        const health = await api("/health", { signal: lifecycle.signal, timeoutMs: 4_000 });
        if (!isCurrent(version)) return;
        if (health.status !== "ok") throw new Error("분석 서버가 아직 준비되지 않았어요. 잠시 뒤 다시 시도해 주세요.");
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("카메라를 쓰려면 부스 컴퓨터의 로컬 주소나 HTTPS 주소로 접속해 주세요. 기존 사진 선택도 사용할 수 있어요.");
        status.textContent = "카메라를 연결하는 중이에요.";
        const camera = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } } });
        if (!isCurrent(version)) { camera.getTracks().forEach((track) => track.stop()); return; }
        stream = camera;
        video.srcObject = stream;
        await video.play();
        if (!isCurrent(version)) return;
        clearPreview();
        analyze.hidden = retake.hidden = open.hidden = true;
        take.hidden = video.hidden = guide.hidden = false;
        placeholder.hidden = true;
        status.textContent = "준비가 되면 촬영 버튼을 눌러 주세요.";
        take.focus();
      } catch (cause) {
        if (!isCurrent(version)) return;
        stopCamera();
        video.hidden = guide.hidden = true;
        placeholder.hidden = Boolean(frame);
        open.hidden = Boolean(frame);
        status.textContent = "";
        const messages = {
          NotAllowedError: "카메라 사용이 허용되지 않았어요. 권한을 확인하거나 기존 사진을 선택해 주세요.",
          NotFoundError: "연결된 카메라를 찾을 수 없어요. 기존 사진 선택으로도 분석할 수 있어요.",
          NotReadableError: "카메라를 사용할 수 없어요. 다른 카메라 앱을 닫거나 기존 사진을 선택해 주세요.",
        };
        showError(error, messages[cause.name] || cause.message || "카메라를 열 수 없어요.");
      } finally {
        if (version === sourceVersion) setWorking(false);
      }
    }

    function canvasBlob(canvas) {
      return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("사진을 만들 수 없어요. 다른 사진을 선택하거나 다시 촬영해 주세요.")), "image/jpeg", 0.9));
    }
    async function finishCapture(version) {
      cancelCountdown();
      setWorking(true);
      try {
        if (!video.videoWidth || !video.videoHeight || video.readyState < 2) throw new Error("카메라 영상이 준비되지 않았어요. 잠시 뒤 다시 찍어 주세요.");
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight));
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
        const captured = await canvasBlob(canvas);
        if (!isCurrent(version)) return;
        stopCamera();
        showPhoto(captured, "capture.jpg", "카메라로 촬영한 사진 · 분석 버튼을 누르면 서버로 전송해요.");
      } catch (cause) {
        if (isCurrent(version)) { status.textContent = ""; showError(error, cause.message); }
      } finally {
        if (version === sourceVersion) setWorking(false);
      }
    }
    function countDown() {
      if (!stream || take.disabled || !hasConsent()) return;
      const version = sourceVersion;
      showError(error);
      let seconds = 3;
      countdown.textContent = seconds;
      countdown.hidden = false;
      status.textContent = "3초 뒤에 촬영해요. 정면을 바라봐 주세요.";
      timer = window.setInterval(() => {
        seconds -= 1;
        if (seconds > 0) countdown.textContent = seconds;
        else finishCapture(version);
      }, 1000);
      take.disabled = true;
    }

    async function selectPhoto() {
      const file = fileInput.files?.[0];
      fileInput.value = "";
      if (!file || working || !hasConsent()) return;
      showError(error);
      if (!file.size || file.size > 10 * 1024 * 1024) { showError(error, "사진은 10MB 이하의 JPG 또는 PNG 파일을 선택해 주세요."); return; }
      if (file.type && !["image/jpeg", "image/png"].includes(file.type)) { showError(error, "JPG 또는 PNG 사진만 선택할 수 있어요. HEIC 사진은 JPG로 변환한 뒤 선택해 주세요."); return; }
      const version = ++sourceVersion;
      cancelCountdown();
      stopCamera();
      video.hidden = guide.hidden = take.hidden = true;
      open.hidden = placeholder.hidden = Boolean(frame);
      setWorking(true);
      status.textContent = "선택한 사진을 준비하는 중이에요.";
      let temporaryUrl;
      try {
        const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
        const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
        const png = [137,80,78,71,13,10,26,10].every((value, index) => bytes[index] === value);
        if (!jpeg && !png) throw new Error("올바른 JPG 또는 PNG 사진이 아니에요. 다른 사진을 선택해 주세요.");
        const image = new Image();
        temporaryUrl = URL.createObjectURL(file);
        image.src = temporaryUrl;
        await image.decode().catch(() => { throw new Error("사진을 열 수 없어요. 손상되지 않은 다른 JPG·PNG 사진을 선택해 주세요."); });
        if (!isCurrent(version)) return;
        if (image.naturalWidth < 100 || image.naturalHeight < 100) throw new Error("사진의 가로·세로는 각각 100px 이상이어야 해요.");
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
        canvas.width = Math.round(image.naturalWidth * scale);
        canvas.height = Math.round(image.naturalHeight * scale);
        const context = canvas.getContext("2d");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const normalized = await canvasBlob(canvas);
        if (!isCurrent(version)) return;
        showPhoto(normalized, "upload.jpg", "기존 사진을 선택했어요 · 분석 버튼을 누르기 전에는 서버로 전송하지 않아요.");
      } catch (cause) {
        if (isCurrent(version)) { status.textContent = ""; showError(error, cause.message); }
      } finally {
        if (temporaryUrl) URL.revokeObjectURL(temporaryUrl);
        if (version === sourceVersion) setWorking(false);
      }
    }

    async function analyzePhoto() {
      if (!frame || working || !hasConsent()) return;
      setWorking(true);
      consent.disabled = true;
      showError(error);
      status.textContent = "퍼스널컬러를 분석하는 중이에요.";
      const form = new FormData();
      form.append("image", frame, filename);
      form.append("consent", String(consent.checked));
      try {
        const result = await api("/api/v1/analyses", { method: "POST", body: form, signal: lifecycle.signal, timeoutMs: 45_000 });
        if (result.status !== "completed" || !result.id) throw new Error("분석 결과를 받지 못했어요. 다시 시도해 주세요.");
        setAnalysis(result.id, result.expires_at);
        location.assign("3.html");
      } catch (cause) {
        if (!lifecycle.signal.aborted) { status.textContent = ""; showError(error, cause.message); }
      } finally {
        setWorking(false);
        consent.disabled = false;
      }
    }

    open.addEventListener("click", openCamera);
    retake.addEventListener("click", openCamera);
    choose.addEventListener("click", () => { if (!working && hasConsent()) fileInput.click(); });
    fileInput.addEventListener("change", selectPhoto);
    take.addEventListener("click", countDown);
    analyze.addEventListener("click", analyzePhoto);
    consent.addEventListener("change", () => {
      if (consent.checked) return;
      sourceVersion += 1;
      resetView();
      setWorking(false);
      status.textContent = "카메라를 중지하고 이 화면의 사진을 지웠어요.";
    });
    window.addEventListener("pagehide", () => {
      sourceVersion += 1;
      lifecycle.abort();
      resetView();
    }, { once: true });
    window.addEventListener("pageshow", (event) => { if (event.persisted) location.reload(); });
  }
  return { initCapture };
})();
