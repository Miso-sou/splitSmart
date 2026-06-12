import { GoogleGenerativeAI } from "@google/generative-ai";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";

// POST /api/bills/parse
export const parseBill = asyncHandler(async (req, res) => {
  // Multer will attach the uploaded file to req.file
  if (!req.file) {
    throw new ApiError(400, "No image provided");
  }

  // Initialize Gemini inside the function so dotenv has time to load the API key
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  // gemini-1.5-flash was retired; using the latest 2.5 series
  const model = genAI.getGenerativeModel({ model: `gemini-2.5-flash` });

  const base64Image = req.file.buffer.toString("base64");

  const prompt = `
    Extract all line items from this restaurant/shop bill.
    If there are taxes, treat the total combined tax as a single item in the "items" array (do NOT split into SGST/CGST, just create one "Total Tax" item).
    
    IMPORTANT: The price listed on the right side of the bill is often the TOTAL row price for that quantity. For the "price" field in your JSON, you MUST calculate and return the UNIT PRICE (i.e., the total row price divided by the quantity). 
    For example, if the bill says "4 x Veg Biryani 360.00", the quantity is 4 and the unit price is 90.00.

    CROSS-CHECK AND MATHEMATICAL VALIDATION:
    Before outputting the final JSON, you must perform this mathematical self-check:
    1. For every regular item, verify that (price * quantity) equals the expected total for that item.
    2. Sum up the calculated totals of all regular items (excluding the "Total Tax" item).
    3. The difference between this sum and the final overall "total" amount must be designated as the "Total Tax" item's price.
    4. Therefore, set the "Total Tax" item's price to (total - sum of all other items), ensuring that when all items in the "items" array (including "Total Tax" with quantity 1) are summed up, the sum is EXACTLY equal to the "total" field.
    5. Do NOT create any adjustment, discount, or rounding items. All discrepancies, taxes, service charges, and rounding differences must be rolled into the single "Total Tax" item.

    Return ONLY valid JSON with no extra text, markdown, or explanation.

    Format:
    {
    "items": [
        { "name": "Item name", "price": 150, "quantity": 1 },
        { "name": "Another item", "price": 80, "quantity": 2 },
        { "name": "Total Tax", "price": 20, "quantity": 1 }
    ],
    "total": 330
    }

    If you cannot read the bill clearly, return:
    { "error": "Could not parse bill" }
    `;

  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        mimeType: req.file.mimetype, // Note: multer uses lowercase 't'
        data: base64Image,
      },
    },
  ]);

  const response = await result.response;
  let text = response.text(); // Use 'let' because we modify it below

  // VERY IMPORTANT
  text = text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  const parsedJson = JSON.parse(text);
  if (parsedJson.error) {
    throw new ApiError(400, parsedJson.error);
  }

  return res.status(200).json(parsedJson);
});
