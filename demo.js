const boothDemo = (() => {
  const demoResult = {
    season: "summer",
    season_ko: "여름 쿨톤",
    analyzer: "v2",
    reliability: "medium",
    warning_messages: ["예시 안내: 두 계절의 특징이 비슷하면 진단천으로 직접 비교해 보세요."],
    reasons: ["예시 분석 근거: 밝고 부드러운 색상 조합을 추천해요."],
    season_scores: { summer: 0.62, spring: 0.25, autumn: 0.08, winter: 0.05 },
    content: {
    "season": "summer",
    "season_ko": "여름 쿨톤",
    "score": 0.62,
    "summary": "붉은·분홍 기가 도는 밝은 피부에 부드럽고 시원한 파스텔이 잘 어울려요.",
    "keywords": [
        "청량함",
        "부드러움",
        "밝은 쿨"
    ],
    "palette": [
        {
            "name": "라벤더",
            "hex": "#B9A6D9"
        },
        {
            "name": "파우더 블루",
            "hex": "#A7C7E7"
        },
        {
            "name": "로즈 핑크",
            "hex": "#E6A1B5"
        },
        {
            "name": "민트",
            "hex": "#A8D8C8"
        },
        {
            "name": "소프트 그레이",
            "hex": "#B7BCC4"
        },
        {
            "name": "라이트 네이비",
            "hex": "#5B6B8C"
        }
    ],
    "makeup": [
        {
            "category": "lip",
            "name": "로즈 핑크",
            "hex": "#C85A7C"
        },
        {
            "category": "blush",
            "name": "라벤더 핑크",
            "hex": "#D9A0BB"
        },
        {
            "category": "eye",
            "name": "소프트 모브",
            "hex": "#9A7F9D"
        }
    ],
    "clothes": {
        "best": [
            "라벤더",
            "하늘색",
            "로즈 핑크",
            "쿨 그레이",
            "소프트 화이트",
            "라이트 네이비"
        ],
        "avoid": [
            "오렌지",
            "머스터드",
            "진한 카키·브라운"
        ]
    },
    "hair": [
        "애쉬 브라운",
        "쿨 다크 브라운",
        "애쉬 계열"
    ],
    "accessory": {
        "metal": "silver",
        "metal_ko": "실버",
        "tip": "실버나 화이트 골드가 피부를 맑아 보이게 해 줘요."
    },
    "booth_lip": "롬앤 피그피그",
    "second_season": {
        "season": "spring",
        "season_ko": "봄 웜톤",
        "score": 0.25
    }
},
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
