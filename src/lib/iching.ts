export type LineType = 6 | 7 | 8 | 9; // 6: Old Yin, 7: Young Yang, 8: Young Yin, 9: Old Yang

export interface HexagramData {
  number: number;
  name: string;
  pinyin: string;
  character: string;
  judgment: string;
  image: string;
  lines: string[];
  binary: string; // e.g., "111111" for Qian
}

export const HEXAGRAMS: Record<string, HexagramData> = {
  "111111": {
    number: 1,
    name: "乾",
    pinyin: "Qián",
    character: "䷀",
    judgment: "乾：元，亨，利，贞。",
    image: "天行健，君子以自强不息。",
    lines: ["潜龙勿用。", "见龙在田，利见大人。", "君子终日乾乾，夕惕若厉，无咎。", "或跃在渊，无咎。", "飞龙在天，利见大人。", "亢龙有悔。"],
    binary: "111111"
  },
  "000000": {
    number: 2,
    name: "坤",
    pinyin: "Kūn",
    character: "䷁",
    judgment: "坤：元，亨，利牝马之贞。",
    image: "地势坤，君子以厚德载物。",
    lines: ["履霜，坚冰至。", "直，方，大，不习无不利。", "含章可贞。或从王事，无成有终。", "括囊；无咎，无誉。", "黄裳，元吉。", "龙战于野，其血玄黄。"],
    binary: "000000"
  },
  "100010": {
    number: 3,
    name: "屯",
    pinyin: "Zhūn",
    character: "䷂",
    judgment: "屯：元，亨，利，贞。勿用有攸往，利建侯。",
    image: "云雷，屯；君子以经纶。",
    lines: ["磐桓，利居贞，利建侯。", "屯如邅如，乘马班如。匪寇婚媾，女子贞不字，十年乃字。", "即鹿无虞，惟入于林中，君子几不如舍，往吝。", "乘马班如，求婚媾，往吉，无不利。", "屯其膏，小贞吉，大贞凶。", "乘马班如，泣血涟如。"],
    binary: "100010"
  },
  "010001": {
    number: 4,
    name: "蒙",
    pinyin: "Méng",
    character: "䷃",
    judgment: "蒙：亨。匪我求童蒙，童蒙求我。初筮告，再三渎，渎则不告。利贞。",
    image: "山下出泉，蒙；君子以果行育德。",
    lines: ["发蒙，利用刑人，用说桎梏，以往吝。", "包蒙吉；纳妇吉；子克家。", "勿用取女；见金夫，不有躬，无攸利。", "困蒙，吝。", "童蒙，吉。", "击蒙；不利为寇，利御寇。"],
    binary: "010001"
  },
  "111010": {
    number: 5,
    name: "需",
    pinyin: "Xū",
    character: "䷄",
    judgment: "需：有孚，光亨，贞吉。利涉大川。",
    image: "云上于天，需；君子以饮食宴乐。",
    lines: ["需于郊。利用恒，无咎。", "需于沙。小有言，终吉。", "需于泥，致寇至。", "需于血，出自穴。", "需于酒食，贞吉。", "入于穴，有不速之客三人来，敬之终吉。"],
    binary: "111010"
  },
  "010111": {
    number: 6,
    name: "讼",
    pinyin: "Sòng",
    character: "䷅",
    judgment: "讼：有孚，窒。惕中吉。终凶。利见大人，不利涉大川。",
    image: "天与水违行，讼；君子以作事谋始。",
    lines: ["不永所事，小有言，终吉。", "不克讼，归而逋，其邑人三百户，无眚。", "食旧德，贞厉，终吉。或从王事，无成。", "不克讼，复即命，渝安贞，吉。", "讼元吉。", "或锡之鞶带，终朝三褫之。"],
    binary: "010111"
  },
  "010000": {
    number: 7,
    name: "师",
    pinyin: "Shī",
    character: "䷆",
    judgment: "师：贞，丈人，吉无咎。",
    image: "地中有水，师；君子以容民畜众。",
    lines: ["师出以律，否臧凶。", "在师中，吉无咎，王三锡命。", "师或舆尸，凶。", "师左次，无咎。", "田有禽，利执言，无咎。长子帅师，弟子舆尸，贞凶。", "大君有命，开国承家，小人勿用。"],
    binary: "010000"
  },
  "000010": {
    number: 8,
    name: "比",
    pinyin: "Bǐ",
    character: "䷇",
    judgment: "比：吉。原筮元永贞，无咎。不宁方来，后夫凶。",
    image: "地上有水，比；先王以建万国，亲诸侯。",
    lines: ["有孚比之，无咎。有孚盈缶，终来有它，吉。", "比之自内，贞吉。", "比之匪人。", "外比之，贞吉。", "显比，王用三驱，失前禽。邑人不诫，吉。", "比之无首，凶。"],
    binary: "000010"
  },
  "111011": { number: 9, name: "小畜", pinyin: "Xiǎo Xù", character: "䷈", judgment: "小畜：亨。密云不雨，自我西郊。", image: "风行天上，小畜；君子以懿文德。", lines: [], binary: "111011" },
  "110111": { number: 10, name: "履", pinyin: "Lǚ", character: "䷉", judgment: "履虎尾，不咥人，亨。", image: "上天下泽，履；君子以辨上下，安民志。", lines: [], binary: "110111" },
  "111000": { number: 11, name: "泰", pinyin: "Tài", character: "䷊", judgment: "泰：小往大来，吉亨。", image: "天地交，泰；后以财成天地之道，辅相天地之宜，以左右民。", lines: [], binary: "111000" },
  "000111": { number: 12, name: "否", pinyin: "Pǐ", character: "䷋", judgment: "否之匪人，不利君子贞，大往小来。", image: "天地不交，否；君子以俭德辟难，不可荣以禄。", lines: [], binary: "000111" },
  "101111": { number: 13, name: "同人", pinyin: "Tóng Rén", character: "䷌", judgment: "同人于野，亨。利涉大川，利君子贞。", image: "天与火，同人；君子以类族辨物。", lines: [], binary: "101111" },
  "111101": { number: 14, name: "大有", pinyin: "Dà Yǒu", character: "䷍", judgment: "大有：元亨。", image: "火在天上，大有；君子以遏恶扬善，顺天休命。", lines: [], binary: "111101" },
  "001000": { number: 15, name: "谦", pinyin: "Qiān", character: "䷎", judgment: "谦：亨，君子有终。", image: "地中有山，谦；君子以裒多益寡，称物平施。", lines: [], binary: "001000" },
  "000100": { number: 16, name: "豫", pinyin: "Yù", character: "䷏", judgment: "豫：利建侯行师。", image: "雷出地奋，豫；先王以作乐崇德，殷荐之上帝，以配祖考。", lines: [], binary: "000100" },
  "100110": { number: 17, name: "随", pinyin: "Suí", character: "䷐", judgment: "随：元亨利贞，无咎。", image: "泽中有雷，随；君子以向晦入宴息。", lines: [], binary: "100110" },
  "011001": { number: 18, name: "蛊", pinyin: "Gǔ", character: "䷑", judgment: "蛊：元亨，利涉大川。先甲三日，后甲三日。", image: "山下有风，蛊；君子以振民育德。", lines: [], binary: "011001" },
  "110000": { number: 19, name: "临", pinyin: "Lín", character: "䷒", judgment: "临：元亨利贞。至于八月有凶。", image: "泽上有地，临；君子以教思无穷，容保民无疆。", lines: [], binary: "110000" },
  "000011": { number: 20, name: "观", pinyin: "Guān", character: "䷓", judgment: "观：盥而不荐，有孚颙若。", image: "风行地上，观；先王以省方观民设教。", lines: [], binary: "000011" },
  "100101": { number: 21, name: "噬嗑", pinyin: "Shì Kè", character: "䷔", judgment: "噬嗑：亨。利用狱。", image: "雷电，噬嗑；先王以明罚敕法。", lines: [], binary: "100101" },
  "101001": { number: 22, name: "贲", pinyin: "Bì", character: "䷕", judgment: "贲：亨。小利有攸往。", image: "山下有火，贲；君子以明庶政，无敢折狱。", lines: [], binary: "101001" },
  "000001": { number: 23, name: "剥", pinyin: "Bō", character: "䷖", judgment: "剥：不利有攸往。", image: "山附于地，剥；上以厚下安宅。", lines: [], binary: "000001" },
  "100000": { number: 24, name: "复", pinyin: "Fù", character: "䷗", judgment: "复：亨。出入无疾，朋来无咎。反复其道，七日来复，利有攸往。", image: "地中有雷，复；先王以至日闭关，商旅不行，后不省方。", lines: [], binary: "100000" },
  "100111": { number: 25, name: "无妄", pinyin: "Wú Wàng", character: "䷘", judgment: "无妄：元亨，利贞。其匪正有眚，不利有攸往。", image: "天下雷行，物与无妄；先王以茂对时，育万物。", lines: [], binary: "100111" },
  "111001": { number: 26, name: "大畜", pinyin: "Dà Xù", character: "䷙", judgment: "大畜：利贞，不家食吉，利涉大川。", image: "天在山中，大畜；君子以多识前言往行，以畜其德。", lines: [], binary: "111001" },
  "100001": { number: 27, name: "颐", pinyin: "Yí", character: "䷚", judgment: "颐：贞吉。观颐，自求口实。", image: "山下有雷，颐；君子以慎言语，节饮食。", lines: [], binary: "100001" },
  "011110": { number: 28, name: "大过", pinyin: "Dà Guò", character: "䷛", judgment: "大过：栋挠，利有攸往，亨。", image: "泽灭木，大过；君子以独立不惧，遁世无闷。", lines: [], binary: "011110" },
  "010010": { number: 29, name: "坎", pinyin: "Kǎn", character: "䷜", judgment: "习坎，有孚，维心亨，行有尚。", image: "水洊至，习坎；君子以常德行，习教事。", lines: [], binary: "010010" },
  "101101": { number: 30, name: "离", pinyin: "Lí", character: "䷝", judgment: "离：利贞，亨。畜牝牛，吉。", image: "明两作离，大人以继明照于四方。", lines: [], binary: "101101" },
  "001110": { number: 31, name: "咸", pinyin: "Xián", character: "䷞", judgment: "咸：亨，利贞，取女吉。", image: "山上有泽，咸；君子以虚受人。", lines: [], binary: "001110" },
  "011100": { number: 32, name: "恒", pinyin: "Héng", character: "䷟", judgment: "恒：亨，无咎，利贞，利有攸往。", image: "雷风，恒；君子以立不易方。", lines: [], binary: "011100" },
  "001111": { number: 33, name: "遁", pinyin: "Dùn", character: "䷠", judgment: "遁：亨，小利贞。", image: "天下有山，遁；君子以远小人，不恶而严。", lines: [], binary: "001111" },
  "111100": { number: 34, name: "大壮", pinyin: "Dà Zhuàng", character: "䷡", judgment: "大壮：利贞。", image: "雷在天上，大壮；君子以非礼弗履。", lines: [], binary: "111100" },
  "000101": { number: 35, name: "晋", pinyin: "Jìn", character: "䷢", judgment: "晋：康侯用锡马蕃庶，昼日三接。", image: "明出地上，晋；君子以自昭明德。", lines: [], binary: "000101" },
  "101000": { number: 36, name: "明夷", pinyin: "Míng Yí", character: "䷣", judgment: "明夷：利艰贞。", image: "明入地中，明夷；君子以莅众，用晦而明。", lines: [], binary: "101000" },
  "101011": { number: 37, name: "家人", pinyin: "Jiā Rén", character: "䷤", judgment: "家人：利女贞。", image: "风自火出，家人；君子以言有物，而行有恒。", lines: [], binary: "101011" },
  "110101": { number: 38, name: "睽", pinyin: "Kuí", character: "䷥", judgment: "睽：小事吉。", image: "上火下泽，睽；君子以同而异。", lines: [], binary: "110101" },
  "001010": { number: 39, name: "蹇", pinyin: "Jiǎn", character: "䷦", judgment: "蹇：利西南，不利东北；利见大人，贞吉。", image: "山上有水，蹇；君子以反身修德。", lines: [], binary: "001010" },
  "010100": { number: 40, name: "解", pinyin: "Xiè", character: "䷧", judgment: "解：利西南，无所往，其来复吉。有攸往，夙吉。", image: "雷雨作，解；君子以赦过宥罪。", lines: [], binary: "010100" },
  "110001": { number: 41, name: "损", pinyin: "Sǔn", character: "䷨", judgment: "损：有孚，元吉，无咎，可贞，利有攸往。", image: "山下有泽，损；君子以惩忿窒欲。", lines: [], binary: "110001" },
  "100011": { number: 42, name: "益", pinyin: "Yì", character: "䷩", judgment: "益：利有攸往，利涉大川。", image: "风雷，益；君子以见善则迁，有过则改。", lines: [], binary: "100011" },
  "111110": { number: 43, name: "夬", pinyin: "Guài", character: "䷪", judgment: "夬：扬于王庭，孚号，有厉，告自邑，不利即戎，利有攸往。", image: "泽上于天，夬；君子以施禄及下，居德则忌。", lines: [], binary: "111110" },
  "011111": { number: 44, name: "姤", pinyin: "Gòu", character: "䷫", judgment: "姤：女壮，勿用取女。", image: "天下有风，姤；后以施命诰四方。", lines: [], binary: "011111" },
  "000110": { number: 45, name: "萃", pinyin: "Cuì", character: "䷬", judgment: "萃：亨。王假有庙，利见大人，亨，利贞。用大牲吉，利有攸往。", image: "泽上于地，萃；君子以除戎器，戒不虞。", lines: [], binary: "000110" },
  "011000": { number: 46, name: "升", pinyin: "Shēng", character: "䷭", judgment: "升：元亨，用见大人，勿恤。南征吉。", image: "地中生木，升；君子以顺德，积小以高大。", lines: [], binary: "011000" },
  "010110": { number: 47, name: "困", pinyin: "Kùn", character: "䷮", judgment: "困：亨，贞，大人吉，无咎，有言不信。", image: "泽无水，困；君子以致命遂志。", lines: [], binary: "010110" },
  "011010": { number: 48, name: "井", pinyin: "Jǐng", character: "䷯", judgment: "井：改邑不改井，无丧无得，往来井井。汔至，亦未繘井，羸其瓶，凶。", image: "木上有水，井；君子以劳民劝相。", lines: [], binary: "011010" },
  "101110": { number: 49, name: "革", pinyin: "Gé", character: "䷰", judgment: "革：己日乃孚，元亨利贞，悔亡。", image: "泽中有火，革；君子以治历明时。", lines: [], binary: "101110" },
  "011101": { number: 50, name: "鼎", pinyin: "Dǐng", character: "䷱", judgment: "鼎：元吉，亨。", image: "木上有火，鼎；君子以正位凝命。", lines: [], binary: "011101" },
  "100100": { number: 51, name: "震", pinyin: "Zhèn", character: "䷲", judgment: "震：亨。震来虩虩，笑言哑哑。震惊百里，不丧匕鬯。", image: "洊雷，震；君子以恐惧修省。", lines: [], binary: "100100" },
  "001001": { number: 52, name: "艮", pinyin: "Gèn", character: "䷳", judgment: "艮其背，不获其身，行其庭，不见其人，无咎。", image: "兼山，艮；君子以思不出其位。", lines: [], binary: "001001" },
  "001011": { number: 53, name: "渐", pinyin: "Jiàn", character: "䷴", judgment: "渐：女归吉，利贞。", image: "山上有木，渐；君子以居贤德，善俗。", lines: [], binary: "001011" },
  "110100": { number: 54, name: "归妹", pinyin: "Guī Mèi", character: "䷵", judgment: "归妹：征凶，无攸利。", image: "泽上有雷，归妹；君子以永终知敝。", lines: [], binary: "110100" },
  "101100": { number: 55, name: "丰", pinyin: "Fēng", character: "䷶", judgment: "丰：亨，王假之，勿忧，宜日中。", image: "雷电皆至，丰；君子以折狱致刑。", lines: [], binary: "101100" },
  "001101": { number: 56, name: "旅", pinyin: "Lǚ", character: "䷷", judgment: "旅：小亨，旅贞吉。", image: "山上有火，旅；君子以明慎用刑，而不留狱。", lines: [], binary: "001101" },
  "011011": { number: 57, name: "巽", pinyin: "Xùn", character: "䷸", judgment: "巽：小亨，利攸往，利见大人。", image: "随风，巽；君子以申命行事。", lines: [], binary: "011011" },
  "110110": { number: 58, name: "兑", pinyin: "Duì", character: "䷹", judgment: "兑：亨，利贞。", image: "丽泽，兑；君子以朋友讲习。", lines: [], binary: "110110" },
  "010011": { number: 59, name: "涣", pinyin: "Huàn", character: "䷺", judgment: "涣：亨。王假有庙，利涉大川，利贞。", image: "风行水上，涣；先王以享于帝立庙。", lines: [], binary: "010011" },
  "110010": { number: 60, name: "节", pinyin: "Jié", character: "䷻", judgment: "节：亨。苦节不可贞。", image: "泽上有水，节；君子以制数度，议德行。", lines: [], binary: "110010" },
  "110011": { number: 61, name: "中孚", pinyin: "Zhōng Fú", character: "䷼", judgment: "中孚：豚鱼吉，利涉大川，利贞。", image: "泽上有风，中孚；君子以议狱缓死。", lines: [], binary: "110011" },
  "001100": { number: 62, name: "小过", pinyin: "Xiǎo Guò", character: "䷽", judgment: "小过：亨，利贞。可小事，不可大事。飞鸟遗之音，不宜上宜下，大吉。", image: "山上有雷，小过；君子以行过乎恭，丧过乎哀，用过乎俭。", lines: [], binary: "001100" },
  "101010": { number: 63, name: "既济", pinyin: "Jì Jì", character: "䷾", judgment: "既济：亨，小利贞。初吉，终乱。", image: "水在火上，既济；君子以思患而预防之。", lines: [], binary: "101010" },
  "010101": { number: 64, name: "未济", pinyin: "Wèi Jì", character: "䷿", judgment: "未济：亨。小狐汔济，濡其尾，无攸利。", image: "火在水上，未济；君子以慎辨物居方。", lines: [], binary: "010101" }
};

// Helper functions for introspection mirrors
export const getBinary = (lines: LineType[]): string => {
  return lines.map(l => (l === 7 || l === 9 ? "1" : "0")).join("");
};

export const getHuGuaLines = (lines: LineType[]): LineType[] => {
  // Hu Gua is formed by lines 2, 3, 4 (lower) and 3, 4, 5 (upper)
  // lines are 1-indexed in traditional terms, so 0-indexed: [1,2,3] and [2,3,4]
  if (lines.length < 6) return [];
  return [lines[1], lines[2], lines[3], lines[2], lines[3], lines[4]];
};

export const getCuoGuaLines = (lines: LineType[]): LineType[] => {
  // Cuo Gua flips all lines (Yang to Yin, Yin to Yang)
  return lines.map(l => {
    if (l === 7) return 8;
    if (l === 9) return 6;
    if (l === 8) return 7;
    if (l === 6) return 9;
    return l;
  });
};

export const getZongGuaLines = (lines: LineType[]): LineType[] => {
  // Zong Gua reverses the order of lines
  return [...lines].reverse();
};
export const BINARY_TO_NUMBER: Record<string, number> = {
  "111111": 1, "000000": 2, "100010": 3, "010001": 4, "111010": 5, "010111": 6, "010000": 7, "000010": 8,
  "111011": 9, "110111": 10, "111000": 11, "000111": 12, "101111": 13, "111101": 14, "001000": 15, "000100": 16,
  "100110": 17, "011001": 18, "110000": 19, "000011": 20, "100101": 21, "101001": 22, "000001": 23, "100000": 24,
  "100111": 25, "111001": 26, "100001": 27, "011110": 28, "010010": 29, "101101": 30, "001110": 31, "011100": 32,
  "001111": 33, "111100": 34, "000101": 35, "101000": 36, "101011": 37, "110101": 38, "001010": 39, "010100": 40,
  "110001": 41, "100011": 42, "111110": 43, "011111": 44, "000110": 45, "011000": 46, "010110": 47, "011010": 48,
  "101110": 49, "011101": 50, "100100": 51, "001001": 52, "001011": 53, "110100": 54, "101100": 55, "001101": 56,
  "011011": 57, "110110": 58, "010011": 59, "110010": 60, "110011": 61, "001100": 62, "101010": 63, "010101": 64
};

// I'll need a full data set. I'll try to find a way to get it.
// For now, I'll use a simplified version or find the data in the repo.
