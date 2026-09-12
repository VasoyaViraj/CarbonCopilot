/** Sends the standard success envelope: { success: true, data }. */
export const sendSuccess = (res, data, status = 200) => res.status(status).json({ success: true, data });
