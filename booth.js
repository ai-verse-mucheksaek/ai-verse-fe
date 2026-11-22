(() => {
  const { analysisPath, api, apiUrl, byId, clearAnalysis, currentAnalysis, currentAnalysisExpiry, isLocalAddress, showError } = boothApi;
  const { initCapture } = boothCapture;
  const { demoPortrait, demoResult } = boothDemo;

  const labels = { lip: "립", blush: "블러셔", eye: "아이섀도" };
  const seasonNames = { spring: "Spring Warm", summer: "Summer Cool", autumn: "Autumn Warm", winter: "Winter Cool" };
  const boothLipSpecs = [
    { id: "romand-bare-apricot", name: "베어 애프리콧", season: "spring" },
    { id: "romand-figfig", name: "피그피그", season: "summer" },
    { id: "romand-acorn-brown", name: "도토리 밤", season: "autumn" },
    { id: "romand-plum-coke", name: "플럼 콕", season: "winter" },
  ];
  const compact = (value) => typeof value === "string" ? value.normalize("NFKC").toLowerCase().replace(/[^a-z가-힣0-9]/g, "") : "";
  function boothLipSpec(product) {
    if (!product || product.category !== "lip" || product.active === false || !hex(product.color_hex)) return null;
    const brand = compact(product.brand);
    return boothLipSpecs.find((spec) => product.id === spec.id || (["롬앤", "romnd", "romand"].includes(brand) && compact(product.name).includes(compact(spec.name)))) || null;
  }
  function boothLips(products) {
    const seen = new Set();
    return (Array.isArray(products) ? products : []).filter((product) => {
      const spec = boothLipSpec(product);
      if (!spec || seen.has(spec.id)) return false;
      seen.add(spec.id);
      return true;
    });
  }
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

  const stringList = (value) => Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.trim()) : [];
  const contentFor = (result) => result.content && typeof result.content === "object" && !Array.isArray(result.content) ? result.content : null;
  const validScore = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;

  function recommendationsFor(result) {
    const supplied = contentFor(result)?.makeup;
    const items = Array.isArray(supplied) && supplied.length ? supplied : result.recommendations || [];
    return items.filter((item) => item && labels[item.category] && hex(item.hex || item.color))
      .map((item) => ({ ...item, color: item.hex || item.color }));
  }

  function paletteFor(result) {
    const supplied = contentFor(result)?.palette;
    const items = Array.isArray(supplied) && supplied.length ? supplied : result.palette || [];
    return items.map((item) => typeof item === "string" ? { hex: item } : item)
      .filter((item) => item && hex(item.hex));
  }

  function sectionTitle(title, caption) {
    const heading = node("div", "", "result-section-title");
    heading.append(node("h2", title));
    if (caption) heading.append(node("span", caption));
    return heading;
  }

  function paletteSection(colors) {
    const section = node("section");
    const palette = node("ul", "", "palette");
    palette.style.setProperty("--palette-count", Math.min(6, Math.max(1, colors.length)));
    for (const color of colors) {
      const item = node("li", "", "swatch-chip");
      const swatch = node("span");
      swatch.style.setProperty("--swatch", color.hex);
      swatch.setAttribute("aria-hidden", "true");
      item.append(swatch);
      if (color.name) item.append(node("strong", color.name));
      item.append(document.createTextNode(color.hex));
      palette.append(item);
    }
    section.append(sectionTitle("나를 빛내는 컬러 팔레트", "Your signature shades"), palette);
    return section;
  }

  function renderResult(container, result, actions) {
    const content = contentFor(result);
    const palette = paletteFor(result);
    const tone = node("div", "", "tone");
    const copy = node("div", "", "tone-copy");
    copy.append(node("span", "MY PERSONAL COLOR"), node("strong", content?.season_ko || result.season_ko), node("p", seasonNames[result.season] || "Personal Color", "serif tone-english"));
    const art = node("div", "", "tone-art");
    art.setAttribute("aria-hidden", "true");
    const colors = palette.slice(0, 4);
    colors.forEach((color, index) => {
      const swatch = node("span");
      swatch.style.setProperty("--swatch", color.hex);
      swatch.style.setProperty("--angle", (index - (colors.length - 1) / 2) * 22 + "deg");
      art.append(swatch);
    });
    tone.append(copy, art);
    const sections = [tone];
    if (content?.summary) sections.push(node("p", content.summary, "result-summary"));
    const keywords = stringList(content?.keywords);
    if (keywords.length) {
      const tags = node("ul", "", "result-keywords");
      tags.setAttribute("aria-label", "나의 컬러 키워드");
      keywords.forEach((keyword) => tags.append(node("li", keyword)));
      sections.push(tags);
    }

    const warnings = stringList(result.warning_messages);
    const reliabilityLabels = { high: "분석 조건 좋음", medium: "분석 조건 참고 필요", low: "재촬영·진단천 비교 권장" };
    if (reliabilityLabels[result.reliability] || warnings.length) {
      const notice = node("section", "", warnings.length || result.reliability === "low" ? "notice result-quality" : "quality-note result-quality");
      notice.setAttribute("aria-label", "촬영 및 분석 조건 안내");
      if (reliabilityLabels[result.reliability]) notice.append(node("strong", reliabilityLabels[result.reliability]));
      if (warnings.length) {
        const list = node("ul");
        warnings.forEach((warning) => list.append(node("li", warning)));
        notice.append(list);
      }
      sections.push(notice);
    }

    const scores = Object.entries(result.season_scores || {})
      .filter(([season, score]) => seasonNames[season] && validScore(score)).sort((a, b) => b[1] - a[1]);
    if (scores.length) {
      const section = node("section", "", "score-section");
      const list = node("ul", "", "season-scores");
      for (const [season, score] of scores) {
        const row = node("li");
        const caption = node("div");
        caption.append(node("span", { spring: "봄 웜톤", summer: "여름 쿨톤", autumn: "가을 웜톤", winter: "겨울 쿨톤" }[season]), node("strong", Math.round(score * 100) + "점"));
        const track = node("div", "", "score-track");
        track.setAttribute("aria-hidden", "true");
        const fill = node("span");
        fill.style.width = (score * 100) + "%";
        track.append(fill);
        row.append(caption, track);
        list.append(row);
      }
      section.append(sectionTitle("유형별 참고 점수"), list, node("p", "분류 기준으로 계산한 참고 점수이며, 진단 정확도나 확률을 뜻하지 않아요.", "hint score-note"));
      sections.push(section);
    }
    const reasons = stringList(result.reasons);
    if (reasons.length) {
      const section = node("section", "", "result-reasons");
      const list = node("ul");
      reasons.forEach((reason) => list.append(node("li", reason)));
      section.append(sectionTitle("이렇게 추천했어요"), list);
      sections.push(section);
    }
    sections.push(paletteSection(palette));
    if (actions) sections.push(actions);

    const style = node("section", "", "stack style-section");
    const ideas = node("dl", "", "style-grid");
    const recommendations = content ? [
      ["어울리는 옷 색", stringList(content.clothes?.best).join(", ")],
      ["비교해 볼 옷 색", stringList(content.clothes?.avoid).join(", ")],
      ["머리색", stringList(content.hair).join(", ")],
      ["액세서리", [content.accessory?.metal_ko, content.accessory?.tip].filter((text) => typeof text === "string" && text).join(" · ")],
    ] : Object.entries(styleIdeas[result.season] || {});
    recommendationsFor(result).forEach((item) => recommendations.push([labels[item.category], item.name]));
    for (const [label, suggestion] of recommendations) {
      if (!suggestion) continue;
      const entry = node("div");
      entry.append(node("dt", label), node("dd", suggestion));
      ideas.append(entry);
    }
    style.append(sectionTitle("나답게 완성하는 스타일", "The finishing touches"), ideas);
    sections.push(style);
    if (content?.booth_lip) {
      const product = node("section", "", "booth-lip-note");
      product.append(node("strong", "현장에서 만나볼 추천 립"), node("p", content.booth_lip));
      sections.push(product);
    }
    if (content?.second_season?.season_ko) {
      sections.push(node("p", "진단천으로 함께 비교해 보세요 · " + content.second_season.season_ko, "hint"));
    }
    sections.push(node("p", result.disclaimer || "조명과 카메라에 따라 결과가 달라질 수 있는 체험용 추천이며 전문 진단을 대체하지 않습니다.", "hint"));
    container.replaceChildren(...sections);
    container.hidden = false;
  }

  function setSessionActionsDisabled(disabled) {
    document.querySelectorAll("[data-session-action]").forEach((button) => { button.disabled = disabled; });
  }

  function initSessionEnd(id, demo, expiresAt) {
    const section = byId("session-controls");
    if (!section || section.dataset.ready) return;
    section.dataset.ready = "true";
    const actions = node("div", "", "actions");
    const reset = node("button", "QR 유지하고 다음 참가자", "button secondary");
    reset.type = "button";
    reset.id = "reset-booth";
    reset.dataset.sessionAction = "true";
    const remove = node("button", "사진·결과 삭제하고 종료", "button danger-outline");
    remove.type = "button";
    remove.id = "delete-analysis";
    remove.dataset.sessionAction = "true";
    actions.append(reset, remove);
    const note = node("p", "다음 참가자로 넘어가도 서버 데이터와 QR은 만료될 때까지 유지됩니다. 삭제 후에는 QR 결과도 열 수 없어요.", "hint");
    const expiry = Date.parse(expiresAt || currentAnalysisExpiry());
    const retention = node("p", demo ? "예시 모드에서는 서버에 저장된 참가자 데이터가 없어요." : Number.isFinite(expiry)
      ? "서버 데이터 보관 만료 예정 · " + new Date(expiry).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" }) + " 이후 서버 정리 작업에서 삭제돼요. 즉시 삭제를 요청할 수도 있어요."
      : "서버 보관 기간은 운영 설정을 따라요(기본 24시간). 즉시 삭제를 요청할 수도 있어요.", "hint");
    section.append(node("h2", "체험을 마칠까요?"), note, retention, actions);
    section.hidden = false;

    const dialog = node("dialog", "", "delete-dialog");
    dialog.id = "delete-dialog";
    dialog.setAttribute("aria-labelledby", "delete-dialog-title");
    dialog.setAttribute("aria-describedby", "delete-dialog-description");
    const title = node("h2", "사진과 결과를 삭제할까요?");
    title.id = "delete-dialog-title";
    const description = node("p", demo ? "예시 화면을 종료하고 처음으로 돌아갑니다. 서버로 삭제 요청을 보내지 않아요."
      : "부스 서버에 저장된 원본 사진·분석·가상 메이크업 결과와 QR 공유 링크를 함께 삭제합니다. 이미 내려받은 파일과 외부 서비스 보관 데이터에는 적용되지 않아요.");
    description.id = "delete-dialog-description";
    const error = node("p", "", "error");
    error.id = "delete-error";
    error.setAttribute("role", "alert");
    error.hidden = true;
    const controls = node("div", "", "actions");
    const cancel = node("button", "취소", "button secondary");
    const confirm = node("button", "삭제하고 종료", "button primary");
    cancel.type = confirm.type = "button";
    confirm.id = "confirm-delete";
    controls.append(cancel, confirm);
    dialog.append(title, description, error, controls);
    document.body.append(dialog);
    let deleting = false;
    const finish = () => {
      clearAnalysis();
      location.replace("1.html");
    };
    reset.addEventListener("click", finish);
    remove.addEventListener("click", () => { showError(error); dialog.showModal(); });
    cancel.addEventListener("click", () => { if (!deleting) dialog.close(); });
    dialog.addEventListener("cancel", (event) => { if (deleting) event.preventDefault(); });
    confirm.addEventListener("click", async () => {
      if (deleting) return;
      deleting = true;
      confirm.disabled = cancel.disabled = true;
      confirm.textContent = "삭제 요청 중…";
      showError(error);
      try {
        if (!demo) await api(analysisPath(id), { method: "DELETE" });
        finish();
      } catch (cause) {
        if (cause.status === 404) { finish(); return; }
        showError(error, "삭제를 완료하지 못했어요. 결과를 유지하고 있으니 연결을 확인한 뒤 다시 시도해 주세요.");
        deleting = false;
        confirm.disabled = cancel.disabled = false;
        confirm.textContent = "다시 삭제 요청";
      }
    });
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
    const comparisonFrame = byId("comparison-frame");
    const comparisonHandle = byId("comparison-handle");
    const before = byId("before-photo");
    const after = byId("after-photo");
    const usage = boothUsage.init(id, { demo, onChange: (available) => { button.disabled = !available; } });

    const colors = recommendationsFor(result);
    colorGroup.replaceChildren(...colors.map((item) => {
      const label = node("label");
      label.append(node("span", labels[item.category] + " · " + item.name, "color-label"));
      const input = node("input");
      input.type = "color";
      input.name = item.category + "_color";
      input.value = item.color;
      label.append(input);
      return label;
    }));

    const lipInput = form.querySelector('[name="lip_color"]');
    let lipTouched = false;
    let lipLoading = false;
    lipInput?.addEventListener("input", () => { lipTouched = true; });
    function applyInitialLip(products) {
      const product = boothLips(products).find((item) => boothLipSpec(item).season === result.season);
      if (product && lipInput && !lipTouched) {
        lipInput.value = product.color_hex;
        lipInput.closest("label").querySelector(".color-label").textContent = "립 · " + product.name;
      }
      return Boolean(product);
    }
    byId("makeup-consent-section").hidden = demo;
    if (demo) {
      byId("provider-note").textContent = "테스트용 일러스트에서 색상과 비교 슬라이더를 확인할 수 있어요.";
      renderProducts(byId("product-list"), demoResult.products);
      applyInitialLip(demoResult.products);
    } else {
      const loadDetails = async () => {
        if (!details.open || details.dataset.loaded) return;
        details.dataset.loaded = "true";
        const note = byId("provider-note");
        const productStatus = byId("product-status");
        note.textContent = "가상 메이크업에 외부 서비스를 쓰는 경우 촬영 사진이 전송돼요.";
        productStatus.textContent = "추천 테스터와 립 초기 색상을 불러오는 중이에요.";
        lipLoading = true;

        const provider = api("/health").then((health) => {
          note.textContent = health.vto_provider === "perfectcorp"
            ? "가상 메이크업을 적용하면 촬영 사진을 YouCam 서버로 보내요."
            : "부스 컴퓨터에서 데모 메이크업을 합성해요.";
        }).catch(() => {});
        const products = (async () => {
          const [recommended, catalog] = await Promise.allSettled([
            api(analysisPath(id) + "/products"), api("/api/v1/products?category=lip"),
          ]);
          const items = recommended.status === "fulfilled" && Array.isArray(recommended.value) ? recommended.value : [];
          const allItems = catalog.status === "fulfilled" && Array.isArray(catalog.value) ? catalog.value : [];
          renderProducts(byId("product-list"), items);
          const initialized = applyInitialLip(items) || applyInitialLip(allItems);
          productStatus.textContent = initialized
            ? items.length ? "" : "추천 테스터 정보를 불러오지 못했어요. 운영자에게 문의해 주세요."
            : "계절에 맞는 롬앤 립 초기 색상을 불러오지 못했어요. 립 색상을 직접 선택하거나 새로고침해 주세요.";
        })().finally(() => { lipLoading = false; });
        await Promise.allSettled([provider, products]);
      };
      details.addEventListener("toggle", loadDetails);
      if (details.open) loadDetails();
    }

    function readIntensity() {
      const value = Number(slider.value);
      const intensity = Number.isFinite(value) ? Math.max(0, Math.min(20, Math.round(value))) : 15;
      slider.value = intensity;
      byId("intensity-value").value = String(intensity);
      return intensity;
    }
    slider.addEventListener("input", readIntensity);
    const updateSplit = () => {
      comparisonFrame.style.setProperty("--split", split.value + "%");
      comparisonHandle.setAttribute("aria-label", "전후 비교 위치 " + split.value + "퍼센트, 좌우로 드래그해 조절");
    };
    const moveSplit = (clientX) => {
      const bounds = comparisonFrame.getBoundingClientRect();
      if (!bounds.width) return;
      split.value = String(Math.round(Math.max(0, Math.min(100, (clientX - bounds.left) / bounds.width * 100))));
      updateSplit();
    };
    let draggingSplit = false;
    comparisonFrame.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      draggingSplit = true;
      comparisonFrame.setPointerCapture(event.pointerId);
      moveSplit(event.clientX);
      event.preventDefault();
    });
    comparisonFrame.addEventListener("pointermove", (event) => {
      if (draggingSplit) moveSplit(event.clientX);
    });
    comparisonFrame.addEventListener("pointerup", (event) => {
      draggingSplit = false;
      if (comparisonFrame.hasPointerCapture(event.pointerId)) comparisonFrame.releasePointerCapture(event.pointerId);
    });
    comparisonFrame.addEventListener("pointercancel", () => { draggingSplit = false; });
    comparisonHandle.addEventListener("keydown", (event) => {
      const step = event.shiftKey ? 10 : 1;
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      if (event.key === "Home") split.value = "0";
      else if (event.key === "End") split.value = "100";
      else split.value = String(Number(split.value) + (event.key === "ArrowRight" ? step : -step));
      updateSplit();
      event.preventDefault();
    });
    split.addEventListener("input", updateSplit);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (button.disabled || !usage.canApply) return;
      if (lipLoading) {
        showError(error, "립 초기 색상을 불러오는 중이에요. 잠시 뒤 다시 적용해 주세요.");
        return;
      }
      if (!demo && !byId("makeup-consent").checked) {
        showError(error, "가상 메이크업 처리와 외부 전송 안내를 확인하고 동의 항목을 체크해 주세요.");
        byId("makeup-consent").focus();
        return;
      }
      usage.setBusy(true);
      setSessionActionsDisabled(true);
      comparison.hidden = true;
      byId("makeup-placeholder").hidden = false;
      showError(error);
      status.textContent = "가상 메이크업을 적용하는 중이에요.";
      const request = Object.fromEntries(new FormData(form));
      request.analysis_id = id;
      request.intensity = readIntensity();

      try {
        let completedMessage = "테스트 이미지에 색상을 적용했어요.";
        if (demo) {
          before.src = demoPortrait({}, 0);
          after.src = demoPortrait(request, request.intensity);
        } else {
          const image = await api("/api/v1/try-ons", {
            useAdmin: true,
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
        await usage.refresh();
        usage.setBusy(false);
        setSessionActionsDisabled(false);
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
        if (!byId("makeup-form").dataset.ready) {
          setUpMakeup(id, analysis.result, demo);
          byId("makeup-form").dataset.ready = "true";
        }
        initSessionEnd(id, demo, analysis.expires_at);
        byId("result-title").replaceChildren(document.createTextNode("당신의 색을 "), node("em", "발견했어요."));
        byId("result-actions").hidden = false;
        byId("experiences").hidden = false;
        byId("result-title").focus();
      } catch (error) {
        byId("result-title").textContent = "결과를 확인하지 못했어요.";
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
    initSessionEnd(id, demo);
    if (demo) {
      markDemo(byId("share-title"));
      byId("back-to-results").href = "3.html?demo=1";
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
