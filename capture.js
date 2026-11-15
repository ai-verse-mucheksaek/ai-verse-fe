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
    const take = byId("take-photo");
    const retake = byId("retake-photo");
    const analyze = byId("analyze-photo");
    const status = byId("capture-status");
    const error = byId("capture-error");
    const lifecycle = new AbortController();
    let stream;
    let frame;
    let previewUrl;
    let timer;

    function stopCamera() {
      stream?.getTracks().forEach((track) => track.stop());
      stream = undefined;
      video.srcObject = null;
    }

    function clearPreview() {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = undefined;
      frame = undefined;
      photo.removeAttribute("src");
      photo.hidden = true;
    }

    async function openCamera() {
      if (open.disabled) return;
      showError(error);
      open.disabled = true;
      retake.disabled = true;
      analyze.disabled = true;
      status.textContent = "분석 서버 연결을 확인하는 중이에요.";

      try {
        const health = await api("/health", { signal: lifecycle.signal, timeoutMs: 4_000 });
        if (health.status !== "ok") throw new Error("분석 서버가 아직 준비되지 않았어요. 잠시 뒤 다시 시도해 주세요.");
        if (lifecycle.signal.aborted) return;
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("카메라를 쓰려면 부스 컴퓨터의 로컬 주소나 HTTPS 주소로 접속해 주세요.");
        }
        status.textContent = "카메라를 연결하는 중이에요.";
        const camera = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } },
        });
        if (lifecycle.signal.aborted) {
          camera.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = camera;
        video.srcObject = stream;
        await video.play();
        if (lifecycle.signal.aborted) return;
        clearPreview();
        analyze.hidden = true;
        retake.hidden = true;
        open.hidden = true;
        take.hidden = false;
        video.hidden = false;
        guide.hidden = false;
        placeholder.hidden = true;
        status.textContent = "준비가 되면 촬영 버튼을 눌러 주세요.";
        take.focus();
      } catch (cause) {
        if (lifecycle.signal.aborted) return;
        stopCamera();
        status.textContent = "";
        open.hidden = Boolean(frame);
        const messages = {
          NotAllowedError: "카메라 사용이 허용되지 않았어요. 브라우저의 카메라 권한을 확인한 뒤 다시 시도해 주세요.",
          NotFoundError: "연결된 카메라를 찾을 수 없어요. 카메라를 연결한 뒤 다시 시도해 주세요.",
          NotReadableError: "카메라를 사용할 수 없어요. 카메라를 쓰는 다른 앱을 닫고 다시 시도해 주세요.",
        };
        showError(error, messages[cause.name] || cause.message || "카메라를 열 수 없어요.");
      } finally {
        open.disabled = false;
        retake.disabled = false;
        analyze.disabled = false;
      }
    }

    function captureFrame() {
      if (!video.videoWidth || !video.videoHeight || video.readyState < 2) {
        return Promise.reject(new Error("카메라 영상이 준비되지 않았어요. 잠시 뒤 다시 찍어 주세요."));
      }
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
      return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("사진을 만들 수 없어요. 다시 찍어 주세요."));
        }, "image/jpeg", 0.9);
      });
    }

    async function finishCapture() {
      countdown.hidden = true;
      try {
        const captured = await captureFrame();
        if (lifecycle.signal.aborted) return;
        frame = captured;
        previewUrl = URL.createObjectURL(frame);
        photo.src = previewUrl;
        photo.hidden = false;
        video.hidden = true;
        guide.hidden = true;
        take.hidden = true;
        retake.hidden = false;
        analyze.hidden = false;
        status.textContent = "사진이 잘 나왔는지 확인해 주세요.";
        stopCamera();
        analyze.focus();
      } catch (cause) {
        status.textContent = "";
        showError(error, cause.message);
      } finally {
        take.disabled = false;
      }
    }

    function countDown() {
      if (!stream || take.disabled) return;
      take.disabled = true;
      showError(error);
      let seconds = 3;
      countdown.textContent = seconds;
      countdown.hidden = false;
      status.textContent = "3초 뒤에 촬영해요. 정면을 바라봐 주세요.";
      timer = window.setInterval(() => {
        seconds -= 1;
        if (seconds > 0) {
          countdown.textContent = seconds;
          return;
        }
        window.clearInterval(timer);
        finishCapture();
      }, 1000);
    }

    async function analyzePhoto() {
      if (!frame || analyze.disabled) return;
      analyze.disabled = true;
      retake.disabled = true;
      showError(error);
      status.textContent = "퍼스널컬러를 분석하는 중이에요.";
      const form = new FormData();
      form.append("image", frame, "capture.jpg");
      // Written consent is collected by the booth operator before starting this flow.
      form.append("consent", "true");

      try {
        const result = await api("/api/v1/analyses", {
          method: "POST",
          body: form,
          signal: lifecycle.signal,
          timeoutMs: 45_000,
        });
        if (result.status !== "completed" || !result.id) {
          throw new Error("분석 결과를 받지 못했어요. 다시 시도해 주세요.");
        }
        setAnalysis(result.id, result.expires_at);
        location.assign("3.html");
      } catch (cause) {
        if (lifecycle.signal.aborted) return;
        status.textContent = "";
        showError(error, cause.message);
      } finally {
        analyze.disabled = false;
        retake.disabled = false;
      }
    }

    open.addEventListener("click", openCamera);
    retake.addEventListener("click", openCamera);
    take.addEventListener("click", countDown);
    analyze.addEventListener("click", analyzePhoto);
    window.addEventListener("pagehide", () => {
      lifecycle.abort();
      window.clearInterval(timer);
      stopCamera();
      clearPreview();
    }, { once: true });
    window.addEventListener("pageshow", (event) => {
      if (event.persisted) location.reload();
    });
  }

  return { initCapture };
})();
