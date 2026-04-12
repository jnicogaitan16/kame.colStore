/**
 * Datos de prueba públicos Wompi (sandbox). No incluye llaves ni secretos.
 * Llaves: variables de entorno del backend / frontend (.env).
 */

export const WOMPI_SANDBOX = {
  cards: {
    approved: {
      number: "4242 4242 4242 4242",
      expiry: "12/29",
      cvc: "123",
      holderName: "NICOLAS",
      holderDocumentType: "CC",
      expectedStatus: "APPROVED",
    },
    declined: {
      number: "4111 1111 1111 1111",
      expiry: "12/29",
      cvc: "123",
      holderName: "NICOLAS",
      holderDocumentType: "CC",
      expectedStatus: "DECLINED",
    },
  },

  /** Celulares 399… oficiales sandbox; no usar el del checkout Kame (p. ej. 300…) ni «mismo número». */
  nequi: {
    approved: { phone: "3991111111", expectedStatus: "APPROVED" },
    declined: { phone: "3992222222", expectedStatus: "DECLINED" },
  },

  pse: {
    approved: {
      financial_institution_code: "1",
      user_type: 0,
      user_legal_id_type: "CC",
      user_legal_id: "1999888777",
      expectedStatus: "APPROVED",
    },
    declined: {
      financial_institution_code: "2",
      user_type: 0,
      user_legal_id_type: "CC",
      user_legal_id: "1999888777",
      expectedStatus: "DECLINED",
    },
  },

  daviplata: {
    otp: {
      approved: "574829",
      declined: "932015",
      declined_no_balance: "186743",
      error: "999999",
    },
    recurring: {
      approved_phone: "3991111111",
      declined_phone: "3992222222",
      declined_invalid_wallet: "3993333333",
      otp_approved: "574829",
      otp_declined: "932016",
    },
  },

  bancolombia_qr: {
    approved: { sandbox_status: "APPROVED" },
    declined: { sandbox_status: "DECLINED" },
    error: { sandbox_status: "ERROR" },
  },

  puntos_colombia: {
    approved_full: { sandbox_status: "APPROVED_ONLY_POINTS" },
    approved_half: { sandbox_status: "APPROVED_HALF_POINTS" },
    declined: { sandbox_status: "DECLINED" },
    error: { sandbox_status: "ERROR" },
  },
} as const;
