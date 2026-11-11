// Every line is spoken aloud as well as shown, so keep them short, warm and
// in the words a parent would use with a small child.

export const LANGS = ['hi', 'gu', 'en'];
export const LANG_LABEL = { hi: 'हिंदी', gu: 'ગુજરાતી', en: 'English' };

const S = {
  title: { hi: 'जलेबी सेवा', gu: 'જલેબી સેવા', en: 'Jalebi Seva' },
  subtitle: {
    hi: 'हलवाई बनो, जलेबी बनाओ, श्रीनाथजी को भोग धरो!',
    gu: 'હલવાઈ બનો, જલેબી બનાવો, શ્રીનાથજીને ભોગ ધરો!',
    en: 'Be the halwai, make jalebi, offer bhog to Shreenathji!',
  },
  play: { hi: 'खेलो', gu: 'રમો', en: 'Play' },
  again: { hi: 'फिर से', gu: 'ફરીથી', en: 'Again' },
  jsk: { hi: 'जय श्री कृष्ण!', gu: 'જય શ્રી કૃષ્ણ!', en: 'Jai Shri Krishna!' },
  loading: { hi: 'तैयारी हो रही है…', gu: 'તૈયારી થઈ રહી છે…', en: 'Getting ready…' },

  // --- the fourteen steps ---
  batter: {
    hi: 'घोल बनाओ! मैदा, दही और पानी डालो।',
    gu: 'ખીરું બનાવો! મેંદો, દહીં અને પાણી નાખો.',
    en: 'Make the batter! Add flour, curd and water.',
  },
  stir: { hi: 'अब गोल गोल घुमाओ!', gu: 'હવે ગોળ ગોળ હલાવો!', en: 'Now stir round and round!' },
  chaasni: {
    hi: 'चाशनी बनाओ! चीनी और पानी डालो।',
    gu: 'ચાસણી બનાવો! ખાંડ અને પાણી નાખો.',
    en: 'Make the sugar syrup! Add sugar and water.',
  },
  kesar: { hi: 'केसर डालो!', gu: 'કેસર નાખો!', en: 'Add the saffron!' },
  elaichi: { hi: 'इलायची डालो!', gu: 'એલચી નાખો!', en: 'Add the cardamom!' },
  fry: {
    hi: 'गरम घी में जलेबी बनाओ! उँगली गोल गोल घुमाओ।',
    gu: 'ગરમ ઘીમાં જલેબી પાડો! આંગળી ગોળ ગોળ ફેરવો.',
    en: 'Make jalebi in the hot ghee! Draw round and round.',
  },
  dip: { hi: 'जलेबी चाशनी में डुबाओ!', gu: 'જલેબી ચાસણીમાં ડુબાડો!', en: 'Dip the jalebi in the syrup!' },
  plate: {
    hi: 'जलेबी पातल में रखो!',
    gu: 'જલેબી પાતળમાં મૂકો!',
    en: 'Put the jalebi on the leaf plate!',
  },
  tokri: { hi: 'अब टोकरी भरो!', gu: 'હવે ટોપલી ભરો!', en: 'Now fill the basket!' },
  bhog: { hi: 'श्रीनाथजी को भोग धरो!', gu: 'શ્રીનાથજીને ભોગ ધરો!', en: 'Offer the bhog to Shreenathji!' },
  tulsi: { hi: 'तुलसी पधराओ!', gu: 'તુલસી પધરાવો!', en: 'Place the tulsi leaf!' },
  jhari: { hi: 'झारीजी पधराओ!', gu: 'ઝારીજી પધરાવો!', en: 'Place the jhari of water!' },
  pardaClose: {
    hi: 'पर्दा लगाओ! ठाकुरजी आरोग रहे हैं।',
    gu: 'પડદો કરો! ઠાકોરજી આરોગે છે.',
    en: 'Close the curtain! Thakorji is having bhog.',
  },
  kirtan: {
    hi: 'कीर्तन गाओ! पखावज, झाँझ और घंटी बजाओ।',
    gu: 'કીર્તન ગાઓ! પખાવજ, ઝાંઝ અને ઘંટડી વગાડો.',
    en: 'Sing kirtan! Play the pakhawaj, jhanjh and bell.',
  },
  pardaOpen: { hi: 'पर्दा खोलो! दर्शन करो।', gu: 'પડદો ખોલો! દર્શન કરો.', en: 'Open the curtain! Have darshan.' },
  jai: { hi: 'श्रीनाथजी की जय!', gu: 'શ્રીનાથજીની જય!', en: 'Shreenathji ki jai!' },
  sarao: {
    hi: 'भोग सराओ! अब यह प्रसाद है।',
    gu: 'ભોગ સરાવો! હવે આ પ્રસાદ છે.',
    en: 'Take the bhog away. Now it is prasad!',
  },
  serve: {
    hi: 'सब वैष्णवों को पातल परोसो!',
    gu: 'બધા વૈષ્ણવોને પાતળ પીરસો!',
    en: 'Lay a leaf plate for every Vaishnav!',
  },
  serveJalebi: { hi: 'अब सबको जलेबी परोसो!', gu: 'હવે બધાને જલેબી પીરસો!', en: 'Now serve jalebi to everyone!' },
  eat: {
    hi: 'सबके साथ प्रसाद खाओ!',
    gu: 'બધા સાથે પ્રસાદ આરોગો!',
    en: 'Eat the prasad together with everyone!',
  },

  // --- parents' corner ---
  parents: { hi: 'माता-पिता के लिए', gu: 'માતા-પિતા માટે', en: 'For parents' },
  hold: { hi: 'दबाकर रखें', gu: 'દબાવી રાખો', en: 'hold' },
  sound: { hi: 'आवाज़', gu: 'અવાજ', en: 'Sound' },
  speech: { hi: 'बोलकर बताओ', gu: 'બોલીને કહો', en: 'Spoken prompts' },
  skip: { hi: 'यह चरण छोड़ें', gu: 'આ પગલું છોડો', en: 'Skip this step' },
  restart: { hi: 'शुरू से', gu: 'શરૂથી', en: 'Start over' },
  close: { hi: 'बंद करें', gu: 'બંધ કરો', en: 'Close' },
};

const PRAISE = {
  hi: ['शाबाश!', 'वाह!', 'बहुत बढ़िया!', 'क्या बात है!'],
  gu: ['શાબાશ!', 'વાહ!', 'બહુ સરસ!', 'ખૂબ સરસ!'],
  en: ['Well done!', 'Wow!', 'Lovely!', 'Hooray!'],
};

let lang = 'hi';
export const setLang = (l) => (lang = LANGS.includes(l) ? l : 'hi');
export const getLang = () => lang;
export const T = (key) => (S[key] ? S[key][lang] || S[key].hi : key);
export const praise = () => PRAISE[lang][Math.floor(Math.random() * PRAISE[lang].length)];
