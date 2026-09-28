export interface ParsedBankSMS {
  amount: number;
  currency: string;
  accountSuffix: string;
  referenceNumber?: string;
  senderInfo?: string;
  timestamp?: string;
  confidence: number;
}

/**
 * Intelligent parser for incoming bank SMS feeds
 */
export function parseBankSMS(text: string): ParsedBankSMS {
  let amount = 0;
  let currency = 'USD';
  let accountSuffix = '';
  let referenceNumber: string | undefined;
  let senderInfo: string | undefined;
  let confidence = 0.5;

  // 1. Amount & Currency extraction
  // Matches: "150.00 THB", "+THB 150.00", "$150.00", "SGD 150.00", "received 150.00", "+150.00"
  const amountPatterns = [
    /(?:THB|฿|\$|SGD|USD|EUR|GBP)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)/i,
    /([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)\s*(?:THB|฿|\$|SGD|USD|EUR|GBP)/i,
    /(?:received|deposit of|in \+|credited with|\+)\s*(?:THB|฿|\$|SGD|USD|EUR|GBP)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)/i,
    /([0-9]+(?:\.[0-9]{2}))/
  ];

  for (const pattern of amountPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const numStr = match[1].replace(/,/g, '');
      const parsed = parseFloat(numStr);
      if (!isNaN(parsed) && parsed > 0) {
        amount = parsed;
        confidence += 0.2;
        break;
      }
    }
  }

  // Currency
  if (/THB|฿|Baht/i.test(text)) currency = 'THB';
  else if (/SGD/i.test(text)) currency = 'SGD';
  else if (/EUR|€/i.test(text)) currency = 'EUR';
  else if (/GBP|£/i.test(text)) currency = 'GBP';
  else if (/\$|USD/i.test(text)) currency = 'USD';

  // 2. Account Suffix extraction (e.g. "x-2834", "ending 2834", "a/c x2834", "...2834")
  const accountPatterns = [
    /(?:to|a\/c|acc(?:ount)?|into|ending in|ending)\s*(?:a\/c|acc)?\s*[:#x\s\.\-]*([0-9]{3,4})\b/i,
    /x+([0-9]{3,4})\b/i,
    /\.{2,}([0-9]{3,4})\b/
  ];

  for (const pattern of accountPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      accountSuffix = match[1];
      confidence += 0.15;
      break;
    }
  }

  // 3. Reference number extraction
  // Matches "Ref: KBANK-78219", "Ref# 12345", "Txn: 891273"
  const refPatterns = [
    /(?:Ref|Reference|Txn|Transaction|Trace)(?:\s*(?:no|num|id|#)?:?|\s*:)\s*([A-Za-z0-9\-_]{5,24})/i,
    /\b([A-Z0-9]{8,20})\b/
  ];

  for (const pattern of refPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      // Exclude pure numbers that match amount or account suffix
      const candidate = match[1].trim();
      if (candidate !== accountSuffix && candidate !== amount.toString()) {
        referenceNumber = candidate;
        confidence += 0.15;
        break;
      }
    }
  }

  // 4. Sender Info
  const senderMatch = text.match(/(?:from|by)\s+([A-Za-z0-9\s\.\-]{3,25}?)(?=\s+(?:to|on|at|Ref|\.|$))/i);
  if (senderMatch && senderMatch[1]) {
    senderInfo = senderMatch[1].trim();
  }

  return {
    amount,
    currency,
    accountSuffix,
    referenceNumber,
    senderInfo,
    confidence: Math.min(1.0, confidence)
  };
}
