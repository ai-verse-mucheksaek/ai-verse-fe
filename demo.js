const boothDemo = (() => {
  const demoResult = {
    season: "summer",
    season_ko: "여름 쿨톤",
    palette: ["#D98CA3", "#B39DDB", "#90CAF9", "#B0BEC5", "#E6A8C5"],
    recommendations: [
      { category: "lip", name: "로즈 핑크", color: "#C85A7C" },
      { category: "blush", name: "라벤더 핑크", color: "#D9A0BB" },
      { category: "eye", name: "소프트 모브", color: "#9A7F9D" },
    ],
    products: [{ category: "lip", name: "예시 립 테스터", color_hex: "#C85A7C", tester_label: "테스트용" }],
    disclaimer: "화면 동작을 확인하기 위한 예시이며 실제 분석 결과가 아니에요.",
  };

  function demoPortrait(colors, intensity) {
    const color = (value, fallback) => /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
    const opacity = intensity / 100;
    const lip = color(colors.lip_color, "#C85A7C");
    const blush = color(colors.blush_color, "#D9A0BB");
    const eye = color(colors.eye_color, "#9A7F9D");
    const svg = [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 240">',
      '<path fill="#F2E6F0" d="M0 0h360v240H0z"/>',
      '<path fill="#79647F" d="M94 240q9-40 55-49h62q46 9 55 49z"/>',
      '<path fill="#E4AB95" d="M160 164h40v29q-20 18-40 0z"/>',
      '<path fill="#503D49" d="M119 87q-1-63 62-63 61 0 61 63v81H119z"/>',
      '<path fill="#F4C5AC" d="M133 88q35 1 59-30 8 21 35 28v30q-2 60-47 64-44-4-47-64z"/>',
      '<path fill="' + eye + '" opacity="' + opacity + '" d="M145 104q14-17 29 0zm41 0q14-17 29 0z"/>',
      '<path fill="none" stroke="#503D49" stroke-width="3" stroke-linecap="round" d="M148 105q10 7 20 0m24 0q10 7 20 0"/>',
      '<g fill="' + blush + '" opacity="' + opacity + '"><ellipse cx="150" cy="126" rx="13" ry="7"/><ellipse cx="210" cy="126" rx="13" ry="7"/></g>',
      '<path fill="#C97C7F" d="M165 146q7-8 15-4 8-4 15 4-15 15-30 0z"/>',
      '<path fill="' + lip + '" opacity="' + opacity + '" d="M165 146q7-8 15-4 8-4 15 4-15 15-30 0z"/>',
      '</svg>',
    ].join("");
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  return { demoResult, demoPortrait };
})();
