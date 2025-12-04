import AffiliateMarketer from "../models/affiliateMarketer/affiliateMarketer.model.js";

const generateUniquePromoCode = async () => {
  let promoCode;
  let isUnique = false;

  while (!isUnique) {
    promoCode = Math.floor(1000 + Math.random() * 9000); // Generate a 4-digit number
    const existingAffiliate = await AffiliateMarketer.findOne({
      promo_code: promoCode,
    });
    if (!existingAffiliate) {
      isUnique = true;
    }
  }

  return promoCode;
};


export default generateUniquePromoCode;