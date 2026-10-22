import type { ReplyApproach, ReplyLanguage, ReplyStyle } from "./types";

const T: Record<ReplyApproach, Record<ReplyLanguage, Record<ReplyStyle, string>>> = {
  apology: {
    en: {
      warm: "Thank you for telling us about your visit. We're really sorry it fell short of what we want for every guest, and we're talking it through with our team so it doesn't happen again. We'd love to hear more and put things right, so please reach us at {c}.",
      professional: "Thank you for your feedback. We apologise that your experience did not meet our standards, and we are reviewing what happened with our team. Please contact us at {c} so that we can address your concerns directly.",
      short: "Thank you for the feedback, and we're sorry we fell short. We're looking into it. Please contact us at {c}.",
    },
    hi: {
      warm: "अपने अनुभव के बारे में बताने के लिए धन्यवाद। हमें सचमुच खेद है कि हम आपकी उम्मीदों पर खरे नहीं उतरे। हम अपनी टीम के साथ इस पर बात कर रहे हैं ताकि आगे ऐसा न हो। कृपया हमसे {c} पर संपर्क करें, हम आपकी बात सुनकर सब ठीक करना चाहेंगे।",
      professional: "आपकी प्रतिक्रिया के लिए धन्यवाद। हमें खेद है कि आपका अनुभव हमारे स्तर के अनुरूप नहीं रहा। हम अपनी टीम के साथ इस मामले की समीक्षा कर रहे हैं। कृपया {c} पर हमसे संपर्क करें ताकि हम आपकी चिंता सीधे दूर कर सकें।",
      short: "आपकी प्रतिक्रिया के लिए धन्यवाद, और असुविधा के लिए हमें खेद है। हम इसे देख रहे हैं। कृपया {c} पर संपर्क करें।",
    },
    hinglish: {
      warm: "Apna experience batane ke liye thank you. Hamein sach mein afsos hai ki hum aapki ummeed par khare nahi utre. Hum apni team ke saath iss par baat kar rahe hain taaki aisa dobara na ho. Please humse {c} par contact karein, hum aapki baat sunkar sab theek karna chahenge.",
      professional: "Aapke feedback ke liye dhanyavaad. Hamein khed hai ki aapka experience hamare standard ke anuroop nahi raha. Hum apni team ke saath iss maamle ki samiksha kar rahe hain. Kripya {c} par humse sampark karein taaki hum aapki chinta seedhe door kar sakein.",
      short: "Feedback ke liye thank you, aur takleef ke liye maafi. Hum ise dekh rahe hain. Please {c} par contact karein.",
    },
  },
  contact: {
    en: {
      warm: "Thank you for taking the time to write. We take every review to heart and we'd really like to understand what happened. Could you get in touch with us at {c}? We'd love to hear from you.",
      professional: "Thank you for your review. We take all feedback seriously and would like to understand your experience in more detail. Please contact us at {c} so that we can look into it.",
      short: "Thanks for your review. We'd like to understand what happened. Please contact us at {c}.",
    },
    hi: {
      warm: "समय निकालकर लिखने के लिए धन्यवाद। हम हर समीक्षा को दिल से लेते हैं और जानना चाहते हैं कि क्या हुआ। क्या आप हमसे {c} पर संपर्क कर सकते हैं? हमें आपसे बात करके खुशी होगी।",
      professional: "आपकी समीक्षा के लिए धन्यवाद। हम सभी प्रतिक्रियाओं को गंभीरता से लेते हैं और आपके अनुभव को विस्तार से समझना चाहते हैं। कृपया {c} पर हमसे संपर्क करें ताकि हम इसकी जाँच कर सकें।",
      short: "आपकी समीक्षा के लिए धन्यवाद। हम जानना चाहते हैं कि क्या हुआ। कृपया {c} पर संपर्क करें।",
    },
    hinglish: {
      warm: "Time nikaal kar likhne ke liye thank you. Hum har review ko dil se lete hain aur samajhna chahte hain ki kya hua. Kya aap humse {c} par contact kar sakte hain? Hamein aapse baat karke khushi hogi.",
      professional: "Aapke review ke liye dhanyavaad. Hum sabhi feedback ko gambhirta se lete hain aur aapke experience ko vistaar se samajhna chahte hain. Kripya {c} par humse sampark karein taaki hum ise dekh sakein.",
      short: "Review ke liye thank you. Hum jaanna chahte hain ki kya hua. Please {c} par contact karein.",
    },
  },
  factual: {
    en: {
      warm: "Thank you for sharing your thoughts. We take every review seriously, but we weren't able to find a visit matching the details described. We'd be glad to look into this with you, so please reach out to us at {c}.",
      professional: "Thank you for your feedback. We take all reviews seriously; however, we were unable to find a visit matching the details described. Please contact us at {c} so that we can look into this further.",
      short: "Thank you for your review. We couldn't find a visit matching these details. Please contact us at {c} so we can look into it.",
    },
    hi: {
      warm: "अपनी राय साझा करने के लिए धन्यवाद। हम हर समीक्षा को गंभीरता से लेते हैं, पर बताए गए विवरण से मेल खाती कोई विज़िट हमें नहीं मिली। हम आपके साथ मिलकर इसे देखना चाहेंगे, कृपया हमसे {c} पर संपर्क करें।",
      professional: "आपकी प्रतिक्रिया के लिए धन्यवाद। हम सभी समीक्षाओं को गंभीरता से लेते हैं, किंतु बताए गए विवरण से मेल खाती कोई विज़िट हमें नहीं मिली। कृपया {c} पर हमसे संपर्क करें ताकि हम इसे आगे देख सकें।",
      short: "आपकी समीक्षा के लिए धन्यवाद। इन विवरणों से मेल खाती कोई विज़िट हमें नहीं मिली। कृपया {c} पर संपर्क करें ताकि हम देख सकें।",
    },
    hinglish: {
      warm: "Apni raay share karne ke liye thank you. Hum har review ko serious lete hain, lekin bataye gaye details se milti-julti koi visit hamein nahi mili. Hum aapke saath milkar ise dekhna chahenge, please humse {c} par contact karein.",
      professional: "Aapke feedback ke liye dhanyavaad. Hum sabhi reviews ko gambhirta se lete hain, kintu bataye gaye details se milti koi visit hamein nahi mili. Kripya {c} par humse sampark karein taaki hum ise aage dekh sakein.",
      short: "Review ke liye thank you. In details se milti koi visit hamein nahi mili. Please {c} par contact karein taaki hum dekh sakein.",
    },
  },
};

export const PLACEHOLDER = "[phone or email]";

/** A ready-made reply, available instantly with no AI call. The owner's contact details are filled in. */
export function templateReply(opts: { approach: ReplyApproach; language: ReplyLanguage; style: ReplyStyle; contact: string }): string {
  return T[opts.approach][opts.language][opts.style].replace("{c}", opts.contact.trim() || PLACEHOLDER);
}
