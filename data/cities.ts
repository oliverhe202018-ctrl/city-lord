export interface BaseCity {
  name: string;
  pinyin: string;
  abbr: string;
  adcode: string;
  center: [number, number]; // [lng, lat]
  province?: string;
  districts?: BaseCity[];
}

export const baseCities: BaseCity[] = [
    { 
    name: "北京", 
    pinyin: "beijing", 
    abbr: "bj", 
    adcode: "110000",
    province: "北京", 
    center: [116.407526, 39.904030], 
    districts: [
      { name: "东城区", pinyin: "dongcheng", abbr: "dc", adcode: "110101", center: [116.422720, 39.931640] },
      { name: "西城区", pinyin: "xicheng", abbr: "xc", adcode: "110102", center: [116.366790, 39.915300] },
      { name: "朝阳区", pinyin: "chaoyang", abbr: "cy", adcode: "110105", center: [116.482380, 39.940560] },
      { name: "海淀区", pinyin: "haidian", abbr: "hd", adcode: "110108", center: [116.305940, 39.982690] },
      { name: "丰台区", pinyin: "fengtai", abbr: "ft", adcode: "110106", center: [116.293120, 39.865040] },
      { name: "石景山区", pinyin: "shijingshan", abbr: "sjs", adcode: "110107", center: [116.223420, 39.914490] },
    ]
  },
  { name: "上海", pinyin: "shanghai", abbr: "sh", adcode: "310000", province: "上海", center: [121.473701, 31.230416] },
  { name: "广州", pinyin: "guangzhou", abbr: "gz", adcode: "440100", province: "广东", center: [113.264434, 23.129162] },
  { name: "深圳", pinyin: "shenzhen", abbr: "sz", adcode: "440300", province: "广东", center: [114.057868, 22.543099] },
  { name: "杭州", pinyin: "hangzhou", abbr: "hz", adcode: "330100", province: "浙江", center: [120.155070, 30.274068] },
  { name: "成都", pinyin: "chengdu", abbr: "cd", adcode: "510100", province: "四川", center: [104.066801, 30.572815] },
  { name: "重庆", pinyin: "chongqing", abbr: "cq", adcode: "500000", province: "重庆", center: [106.551556, 29.563009] },
  { name: "武汉", pinyin: "wuhan", abbr: "wh", adcode: "420100", province: "湖北", center: [114.305392, 30.593098] },
  { name: "南京", pinyin: "nanjing", abbr: "nj", adcode: "320100", province: "江苏", center: [118.796877, 32.060255] },
  { name: "西安", pinyin: "xian", abbr: "xa", adcode: "610100", province: "陕西", center: [108.939770, 34.341574] },
  { name: "苏州", pinyin: "suzhou", abbr: "sz", adcode: "320500", province: "江苏", center: [120.585315, 31.298886] },
  { name: "长沙", pinyin: "changsha", abbr: "cs", adcode: "430100", province: "湖南", center: [112.938814, 28.228209] },
  { name: "郑州", pinyin: "zhengzhou", abbr: "zz", adcode: "410100", province: "河南", center: [113.625368, 34.746600] },
  { name: "青岛", pinyin: "qingdao", abbr: "qd", adcode: "370200", province: "山东", center: [120.382612, 36.067108] },
  { name: "厦门", pinyin: "xiamen", abbr: "xm", adcode: "350200", province: "福建", center: [118.089425, 24.479833] },
  { name: "天津", pinyin: "tianjin", abbr: "tj", adcode: "120000", province: "天津", center: [117.200983, 39.084158] },
  { name: "东莞", pinyin: "dongguan", abbr: "dg", adcode: "441900", province: "广东", center: [113.751799, 23.020672] },
  { name: "佛山", pinyin: "foshan", abbr: "fs", adcode: "440600", province: "广东", center: [113.121441, 23.021548] },
  { name: "宁波", pinyin: "ningbo", abbr: "nb", adcode: "330200", province: "浙江", center: [121.550357, 29.874556] },
  { name: "无锡", pinyin: "wuxi", abbr: "wx", adcode: "320200", province: "江苏", center: [120.311910, 31.491170] },
  { name: "合肥", pinyin: "hefei", abbr: "hf", adcode: "340100", province: "安徽", center: [117.227239, 31.820586] },
  { name: "昆明", pinyin: "kunming", abbr: "km", adcode: "530100", province: "云南", center: [102.832891, 24.880095] },
  { name: "济南", pinyin: "jinan", abbr: "jn", adcode: "370100", province: "山东", center: [117.119999, 36.651216] },
  { name: "福州", pinyin: "fuzhou", abbr: "fz", adcode: "350100", province: "福建", center: [119.296531, 26.074507] },
  { name: "哈尔滨", pinyin: "haerbin", abbr: "heb", adcode: "230100", province: "黑龙江", center: [126.633323, 45.756539] },
  { name: "沈阳", pinyin: "shenyang", abbr: "sy", adcode: "210100", province: "辽宁", center: [123.431474, 41.805698] },
  { name: "大连", pinyin: "dalian", abbr: "dl", adcode: "210200", province: "辽宁", center: [121.614682, 38.914003] },
  { name: "南宁", pinyin: "nanning", abbr: "nn", adcode: "450100", province: "广西", center: [108.366543, 22.817002] },
  { name: "长春", pinyin: "changchun", abbr: "cc", adcode: "220100", province: "吉林", center: [125.323544, 43.817071] },
  { name: "石家庄", pinyin: "shijiazhuang", abbr: "sjz", adcode: "130100", province: "河北", center: [114.514860, 38.042306] },
  { name: "太原", pinyin: "taiyuan", abbr: "ty", adcode: "140100", province: "山西", center: [112.548879, 37.870590] },
  { name: "贵阳", pinyin: "guiyang", abbr: "gy", adcode: "520100", province: "贵州", center: [106.630153, 26.647661] },
  { name: "兰州", pinyin: "lanzhou", abbr: "lz", adcode: "620100", province: "甘肃", center: [103.834303, 36.061089] },
  { name: "南昌", pinyin: "nanchang", abbr: "nc", adcode: "360100", province: "江西", center: [115.857963, 28.683016] },
  { name: "海口", pinyin: "haikou", abbr: "hk", adcode: "460100", province: "海南", center: [110.329315, 20.017377] },
];
