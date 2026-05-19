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

    Return ONLY valid JSON with no extra text, markdown, or explanation.

    Format:
    {
    "items": [
        { "name": "Item name", "price": 150, "quantity": 1 },
        { "name": "Another item", "price": 80, "quantity": 2 }
    ],
    "subtotal": 310,
    "tax": 20,
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
