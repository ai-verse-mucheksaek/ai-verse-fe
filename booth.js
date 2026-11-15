(() => {
  const { analysisPath, api, apiUrl, byId, clearAnalysis, currentAnalysis, currentAnalysisExpiry, isLocalAddress, showError } = boothApi;
  const { initCapture } = boothCapture;
  const { demoPortrait, demoResult } = boothDemo;

  const labels = { lip: "립", blush: "블러셔", eye: "아이" };
  const seasonNames = { spring: "Spring Warm", summer: "Summer Cool", autumn: "Autumn Warm", winter: "Winter Cool" };
  const styleIdeas = {
    spring: { "옷": "피치, 크림 아이보리, 연두", "머리색": "허니 브라운, 골든 브라운", "액세서리": "옐로 골드, 로즈 골드" },
    summer: { "옷": "라벤더, 더스티 로즈, 소프트 블루", "머리색": "애쉬 브라운, 코코아 브라운", "액세서리": "실버, 화이트 골드" },
    autumn: { "옷": "카멜, 올리브, 테라코타", "머리색": "체스트넛 브라운, 다크 초콜릿", "액세서리": "앤티크 골드, 브론즈" },
    winter: { "옷": "선명한 화이트, 네이비, 플럼", "머리색": "블루 블랙, 딥 브라운", "액세서리": "실버, 화이트 골드" },
  };

  function node(tag, text, className) {
    const element = document.createElement(tag);
    if (text) element.textContent = text;
    if (className) element.className = className;
    return element;
  }

  function hex(value) {
    return /^#[0-9a-f]{6}$/i.test(value || "") ? value : null;
  }

  function paletteSection(colors) {
    const section = node("section");
    const palette = node("ul", "", "palette");
    for (const color of colors) {
      if (!hex(color)) continue;
      const item = node("li", "", "swatch-chip");
      const swatch = node("span");
      swatch.style.setProperty("--swatch", color);
      swatch.setAttribute("aria-hidden", "true");
      item.append(swatch, document.createTextNode(color));
      palette.append(item);
    }
    const heading = node("div", "", "result-section-title");
    heading.append(node("h2", "나를 빛내는 컬러 팔레트"), node("span", "Your signature shades"));
    section.append(heading, palette);
    return section;
  }

  function renderResult(container, result, actions) {
    const tone = node("div", "", "tone");
    const copy = node("div", "", "tone-copy");
    copy.append(node("span", "MY PERSONAL COLOR"), node("strong", result.season_ko), node("p", seasonNames[result.season] || "Personal Color", "serif tone-english"));
    const art = node("div", "", "tone-art");
    art.setAttribute("aria-hidden", "true");
    const colors = (result.palette || []).filter(hex).slice(0, 4);
    colors.forEach((color, index) => {
      const swatch = node("span");
      swatch.style.setProperty("--swatch", color);
      swatch.style.setProperty("--angle", (index - (colors.length - 1) / 2) * 22 + "deg");
      art.append(swatch);
    });
    tone.append(copy, art);
    const style = node("section", "", "stack style-section");
    const ideas = node("dl", "", "style-grid");
    const recommendations = Object.entries(styleIdeas[result.season] || {});
    for (const item of result.recommendations || []) {
      recommendations.push([labels[item.category] || item.category, item.name]);
    }
    for (const [label, suggestion] of recommendations) {
      const entry = node("div");
      entry.append(node("dt", label), node("dd", suggestion));
      ideas.append(entry);
    }
    const styleHeading = node("div", "", "result-section-title");
    styleHeading.append(node("h2", "나답게 완성하는 스타일"), node("span", "The finishing touches"));
    style.append(styleHeading, ideas);

    container.replaceChildren(
      tone,
      paletteSection(result.palette || []),
      ...(actions ? [actions] : []),
      style,
      node("p", result.disclaimer, "hint"),
    );
    container.hidden = false;
  }

  function renderProducts(list, products) {
    const rows = products.map((product) => {
      const item = node("li");
      const dot = node("span", "", "product-dot");
      dot.setAttribute("aria-hidden", "true");
      dot.style.setProperty("--swatch", hex(product.color_hex) || "#e9dee6");
      const copy = node("div");
      const name = [product.brand, product.name].filter(Boolean).join(" ");
      const description = [labels[product.category], product.tester_label].filter(Boolean).join(" · ");
      copy.append(node("strong", name), node("p", description, "hint"));
      item.append(dot, copy);
      return item;
    });
    list.replaceChildren(...rows);
    list.hidden = rows.length === 0;
  }

  function requireAnalysis() {
    const id = currentAnalysis();
    if (!id) {
      location.replace("1.html");
      return null;
    }
    window.addEventListener("pageshow", (event) => {
      if (event.persisted && currentAnalysis() !== id) location.replace("1.html");
    });
    return id;
  }

  function markDemo(heading) {
    heading.after(node("p", "테스트 모드 · 예시 데이터로 화면을 확인하고 있어요.", "notice"));
  }

  function setUpMakeup(id, result, demo) {
    const details = byId("makeup-details");
    const colorGroup = byId("makeup-colors");
    const form = byId("makeup-form");
    const button = byId("apply-makeup");
    const slider = byId("makeup-intensity");
    const status = byId("makeup-status");
    const error = byId("makeup-error");
    const comparison = byId("comparison");
    const split = byId("comparison-slider");
    const before = byId("before-photo");
    const after = byId("after-photo");

    const colors = (result.recommendations || []).filter((item) => labels[item.category] && hex(item.color));
    colorGroup.replaceChildren(...colors.map((item) => {
      const label = node("label", labels[item.category] + " · " + item.name);
      const input = node("input");
      input.type = "color";
      input.name = item.category + "_color";
      input.value = item.color;
      label.append(input);
      return label;
    }));

    if (demo) {
      byId("provider-note").textContent = "테스트용 일러스트에서 색상과 비교 슬라이더를 확인할 수 있어요.";
      renderProducts(byId("product-list"), demoResult.products);
    } else {
      const loadDetails = async () => {
        if (!details.open || details.dataset.loaded) return;
        details.dataset.loaded = "true";
        const note = byId("provider-note");
        const productStatus = byId("product-status");
        note.textContent = "가상 메이크업에 외부 서비스를 쓰는 경우 촬영 사진이 전송돼요.";
        productStatus.textContent = "추천 테스터를 불러오는 중이에요.";

        const provider = api("/health").then((health) => {
          note.textContent = health.vto_provider === "perfectcorp"
            ? "가상 메이크업을 적용하면 촬영 사진을 YouCam 서버로 보내요."
            : "부스 컴퓨터에서 데모 메이크업을 합성해요.";
        }).catch(() => {});
        const products = api(analysisPath(id) + "/products").then((items) => {
          renderProducts(byId("product-list"), items);
          productStatus.textContent = items.length ? "" : "운영자에게 사용할 수 있는 테스터를 문의해 주세요.";
        }).catch(() => {
          productStatus.textContent = "테스터 정보를 불러오지 못했어요. 운영자에게 문의해 주세요.";
        });
        await Promise.allSettled([provider, products]);
      };
      details.addEventListener("toggle", loadDetails);
      if (details.open) loadDetails();
    }

    slider.addEventListener("input", () => { byId("intensity-value").value = slider.value; });
    const updateSplit = () => byId("comparison-frame").style.setProperty("--split", split.value + "%");
    split.addEventListener("input", updateSplit);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (button.disabled) return;
      button.disabled = true;
      comparison.hidden = true;
      byId("makeup-placeholder").hidden = false;
      showError(error);
      status.textContent = "가상 메이크업을 적용하는 중이에요.";
      const request = Object.fromEntries(new FormData(form));
      request.analysis_id = id;
      request.intensity = Number(slider.value);

      try {
        let completedMessage = "테스트 이미지에 색상을 적용했어요.";
        if (demo) {
          before.src = demoPortrait({}, 0);
          after.src = demoPortrait(request, request.intensity);
        } else {
          const image = await api("/api/v1/try-ons", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(request),
            timeoutMs: 150_000,
          });
          if (image.status !== "completed" || !image.before_image_url || !image.result_image_url) {
            throw new Error("메이크업 이미지를 받지 못했어요. 다시 시도해 주세요.");
          }
          before.src = apiUrl(image.before_image_url);
          after.src = apiUrl(image.result_image_url);
          completedMessage = image.provider === "mock" ? "데모 메이크업을 적용했어요." : "가상 메이크업을 적용했어요.";
        }
        await Promise.all([before.decode(), after.decode()]).catch(() => {
          throw new Error("비교 이미지를 열지 못했어요. 다시 시도해 주세요.");
        });
        split.value = 50;
        updateSplit();
        comparison.hidden = false;
        byId("makeup-placeholder").hidden = true;
        status.textContent = completedMessage;
        split.focus();
      } catch (cause) {
        status.textContent = "";
        showError(error, cause.message);
      } finally {
        button.disabled = false;
      }
    });
  }

  function initResults(demo) {
    const id = demo ? null : requireAnalysis();
    if (!demo && !id) return;
    const status = byId("result-status");
    const retry = byId("retry-result");
    if (demo) {
      markDemo(byId("result-title"));
      byId("result-qr-link").href = "4.html?demo=1";
    }

    async function load() {
      retry.disabled = true;
      byId("result-error").hidden = true;
      status.textContent = "결과를 불러오는 중이에요.";
      try {
        const analysis = demo ? { status: "completed", result: demoResult } : await api(analysisPath(id));
        if (analysis.status !== "completed" || !analysis.result) throw new Error("완료된 분석 결과가 없어요.");
        renderResult(byId("result-content"), analysis.result, byId("result-actions"));
        setUpMakeup(id, analysis.result, demo);
        byId("result-actions").hidden = false;
        byId("experiences").hidden = false;
        byId("result-title").focus();
      } catch (error) {
        byId("result-error-text").textContent = error.message;
        byId("result-error").hidden = false;
        retry.hidden = error.status === 404;
      } finally {
        status.textContent = "";
        retry.disabled = false;
      }
    }

    retry.addEventListener("click", load);
    load();
  }

  function renderQr(container, link) {
    const qr = new window.BoothQRCode(-1, window.BoothQRErrorLevel.M);
    qr.addData(link);
    qr.make();
    const size = qr.getModuleCount();
    const namespace = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(namespace, "svg");
    svg.setAttribute("viewBox", "0 0 " + (size + 8) + " " + (size + 8));
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "휴대폰에서 컬러 카드를 여는 QR 코드");
    svg.setAttribute("shape-rendering", "crispEdges");
    const path = document.createElementNS(namespace, "path");
    const cells = [];
    for (let row = 0; row < size; row++) {
      for (let column = 0; column < size; column++) {
        if (qr.isDark(row, column)) cells.push("M" + (column + 4) + " " + (row + 4) + "h1v1h-1z");
      }
    }
    path.setAttribute("d", cells.join(""));
    path.setAttribute("fill", "#171119");
    svg.append(path);
    container.replaceChildren(svg);
    container.hidden = false;
  }

  function initBoothShare(demo) {
    const id = demo ? null : requireAnalysis();
    if (!demo && !id) return;
    const status = byId("share-status");
    const error = byId("share-error");
    const retry = byId("retry-share");
    const ready = byId("share-ready");
    const open = byId("open-card");
    const copy = byId("copy-card");
    if (demo) {
      markDemo(byId("share-title"));
      byId("back-to-results").href = "3.html?demo=1";
    } else {
      byId("reset-note").hidden = false;
    }

    async function issueLink() {
      retry.hidden = true;
      ready.hidden = true;
      showError(error);
      status.textContent = "결과 링크를 만드는 중이에요.";
      try {
        const url = new URL("4.html", location.href);
        if (demo) {
          url.hash = "demo=1";
        } else {
          const share = await api(analysisPath(id) + "/share", { method: "POST" });
          if (!share.token) throw new Error("공유 링크를 받지 못했어요.");
          url.hash = new URLSearchParams({ result: share.token }).toString();
          const expiryTimes = [share.expires_at, currentAnalysisExpiry()].map(Date.parse).filter(Number.isFinite);
          const cutoff = Math.min(...expiryTimes);
          if (cutoff <= Date.now()) {
            showError(error, "공유할 수 있는 시간이 끝났어요.");
            status.textContent = "";
            return;
          }
          if (Number.isFinite(cutoff)) {
            const expiry = byId("share-expiry");
            const expires = new Date(cutoff).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" });
            expiry.textContent = "링크를 열 수 있는 시간 · 최대 " + expires;
            expiry.hidden = false;
          }
        }
        open.href = url.href;
        const localNote = byId("local-share-note");
        localNote.hidden = !isLocalAddress(url);
        ready.hidden = false;
        const filePreview = url.protocol === "file:";
        copy.hidden = filePreview || !navigator.clipboard?.writeText;
        if (filePreview) {
          localNote.textContent = "파일로 열었어요. QR 이미지는 프론트 서버에서 확인해 주세요.";
          status.textContent = "";
          return;
        }
        try {
          renderQr(byId("share-qr"), url.href);
        } catch {
          byId("share-qr").hidden = true;
          status.textContent = "QR 이미지를 만들지 못했어요. 아래 링크로 결과를 열 수 있어요.";
          return;
        }
        status.textContent = "";
      } catch (cause) {
        status.textContent = "";
        showError(error, cause.message);
        retry.hidden = cause.status === 404;
      }
    }

    copy.addEventListener("click", async () => {
      const message = byId("copy-status");
      try {
        await navigator.clipboard.writeText(open.href);
        message.textContent = "결과 링크를 복사했어요.";
      } catch {
        message.textContent = "링크를 복사할 수 없어요. 결과 카드를 열어 주소를 복사해 주세요.";
      }
    });
    retry.addEventListener("click", issueLink);
    byId("reset-booth").addEventListener("click", () => {
      clearAnalysis();
      location.replace("1.html");
    });
    issueLink();
  }

  function initPublicCard(token, demo) {
    document.body.dataset.mode = "public";
    document.querySelector(".brand").removeAttribute("href");
    byId("booth-share").hidden = true;
    byId("share-steps").hidden = true;
    byId("public-card").hidden = false;
    if (demo) markDemo(byId("public-title"));
    const status = byId("public-status");
    const error = byId("public-error");
    const retry = byId("retry-public");
    if (!demo && !/^[\w-]{16,128}$/.test(token)) {
      showError(error, "올바른 결과 카드 링크인지 확인해 주세요.");
      status.textContent = "";
      return;
    }

    async function load() {
      retry.hidden = true;
      showError(error);
      status.textContent = "결과 카드를 불러오는 중이에요.";
      try {
        const result = demo ? demoResult : await api("/api/v1/public/results/" + encodeURIComponent(token));
        renderResult(byId("public-content"), result);
        const products = result.products || [];
        renderProducts(byId("public-product-list"), products);
        byId("public-products").hidden = products.length === 0;
        byId("public-actions").hidden = false;
      } catch (cause) {
        showError(error, cause.message);
        retry.hidden = cause.status === 404;
      } finally {
        status.textContent = "";
      }
    }

    retry.addEventListener("click", load);
    byId("print-card").addEventListener("click", () => window.print());
    load();
  }

  document.querySelector(".brand").addEventListener("click", clearAnalysis);

  const query = new URLSearchParams(location.search);
  const demo = query.get("demo") === "1";

  switch (document.body.dataset.page) {
    case "start": {
      const start = byId("start-experience");
      start.addEventListener("click", clearAnalysis);
      break;
    }
    case "capture":
      initCapture();
      break;
    case "results":
      initResults(demo);
      break;
    case "share": {
      const fragment = new URLSearchParams(location.hash.slice(1));
      const token = fragment.get("result");
      const demoCard = fragment.get("demo") === "1";
      if (token !== null || demoCard) initPublicCard(token, demoCard);
      else initBoothShare(demo);
      break;
    }
  }
})();
