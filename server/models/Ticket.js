const mongoose = require("mongoose");

const TicketSchema = new mongoose.Schema(
  {
    ticketId: { 
      type: String, 
      required: true, 
      unique: true,
      index: true 
    },
    title: { type: String, required: true },       // Added for frontend table
    subject: { type: String, required: true },
    description: { type: String },                // Added for ticket details
    sender: { type: String, default: null },
    senderEmail: { type: String, required: true },
    bodyPreview: { type: String },
    receivedDateTime: { type: Date },
    outlookMessageId: { type: String, unique: true, sparse: true },
    status: { type: String, default: "Open" },
    source: { type: String, default: "Outlook Email" },
    issueType: { type: String, default: "Email Support" }, // Added for category filter
    priority: { type: String, default: "Medium" },         // Added for priority filter
    generator: { type: String },                          // Added for creator/source display
    companyId: { type: String, default: "openport123" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Ticket", TicketSchema);