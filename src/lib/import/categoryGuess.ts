// 거래처(가맹점)명 → 비용 카테고리 자동 추천.
// 카드/현금영수증 사용내역 임포트 시 사용. 키워드 일치하면 카테고리 추천.
// 매칭 안 되면 undefined → 사용자가 직접 선택.

const RULES: Array<{ category: string; patterns: RegExp[] }> = [
  {
    category: "식자재",
    patterns: [
      /이마트|롯데마트|홈플러스|코스트코|하나로마트|농협마트/,
      /노량진수산|가락시장|마장축산|건어물|정육|수산|청과|채소|곡물/,
      /쿠팡(?!이츠)|마켓컬리|SSG|오아시스|G마켓.*식품|11번가.*식품/,
      /도매상|식자재|식품유통/,
    ],
  },
  {
    category: "복리후생",
    patterns: [
      /스타벅스|이디야|투썸|커피빈|할리스|폴바셋|블루보틀|메가커피|컴포즈|빽다방/,
      /파리바게뜨|뚜레쥬르|배스킨라빈스|던킨|크리스피크림/,
      /BBQ|BHC|교촌|굽네|네네|파파존스|피자헛|도미노피자/,
      /김밥|샐러드|편의점|GS25|CU|세븐일레븐|이마트24/,
      /배달의민족|요기요|쿠팡이츠/,
    ],
  },
  {
    category: "차량유지",
    patterns: [
      /GS칼텍스|SK주유|SK에너지|S-OIL|에쓰오일|현대오일|HD현대오일|알뜰주유/,
      /자동차정비|카센터|타이어|엔진오일|차량용품/,
      /하이패스|롯데렌터카|SK렌터카|롯데렌탈|쏘카|그린카/,
      /주차장|주차요금/,
    ],
  },
  {
    category: "통신비",
    patterns: [
      /SKT|KT|LGU|LG.유플러스|LG.유\+|알뜰폰|MVNO/,
      /인터넷.*요금|와이브로|모바일.*요금/,
    ],
  },
  {
    category: "수도광열",
    patterns: [
      /한국전력|한전|수도사업|상수도|도시가스|지역난방|가스공사/,
    ],
  },
  {
    category: "임차료",
    patterns: [/월세|임대료|임차료|관리비/],
  },
  {
    category: "사무용품",
    patterns: [
      /다이소|아트박스|모닝글로리|교보문고|영풍문고|반디앤루니스|알라딘/,
      /오피스디포|문구|사무용품|복사용지|토너|잉크/,
      /쿠팡(?:로지스틱스)?.*사무/,
    ],
  },
  {
    category: "광고선전비",
    patterns: [
      /네이버.*광고|구글.*광고|페이스북|메타|카카오.*광고|인스타그램|유튜브.*광고/,
      /검색광고|디스플레이.*광고|배너광고|키워드광고/,
      /당근마켓.*광고|네이버스마트스토어/,
    ],
  },
  {
    category: "여비교통",
    patterns: [
      /카카오.?T|우버|타다|마카롱택시|이택시/,
      /고속버스|시외버스|KTX|코레일|기차|항공|아시아나|대한항공|제주항공|진에어/,
      /숙박|호텔|모텔|에어비앤비|airbnb|야놀자|여기어때/,
    ],
  },
  {
    category: "지급수수료",
    patterns: [
      /수수료|세무사|법무사|회계사|변호사|컨설팅|기장료/,
      /은행.*수수료|이체수수료/,
    ],
  },
  {
    category: "교육훈련",
    patterns: [/학원|교육|강의|세미나|컨퍼런스|스터디|클래스101|인프런/],
  },
  {
    category: "도서인쇄",
    patterns: [/인쇄소|복사|출력|명함|전단지|제본/],
  },
  {
    category: "접대비",
    patterns: [/.+(룸|살롱|클럽|단란주점|노래방|유흥)/],
  },
];

export function suggestCategory(counterparty: string): string | undefined {
  const name = counterparty.trim();
  if (!name) return undefined;
  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(name)) return rule.category;
    }
  }
  return undefined;
}
