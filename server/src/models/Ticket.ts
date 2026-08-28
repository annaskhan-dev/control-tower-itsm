const mongoose = require("mongoose");

const TicketSchema = new mongoose.Schema(
  {
    ticketId: { 
      type: String, 
      required: true, 
      unique: true,
      index: true 
    },
    title: { type: String, required: true },      // Added for frontend table
    subject: { type: String, required: true },
    description: { type: String },                // Added for ticket details
    sender: { type: String, default: null },
    senderEmail: { type: String, required: true },
    bodyPreview: { type: String },
    receivedDateTime: { type: Date },
    outlookMessageId: { type: String, unique: true, sparse: true },
    status: { 
      type: String, 
      default: "Open",
      enum: ["Open", "In Progress", "Resolved", "Closed", "Pending"] // Standardized status tracking
    },
    source: { 
      type: String, 
      default: "Email" // Updated default source to match your new requirement
    },
    issueType: { 
      type: String, 
      default: "General Support",
      index: true // Indexed for fast filtering by category on admin dashboards
    }, 
    priority: { 
      type: String, 
      default: "Medium",
      enum: ["Low", "Medium", "High", "Urgent"] 
    },         
    generator: { type: String },                            // Added for creator/source display
    companyId: { type: String, default: "openport123" }
  },
  { timestamps: true }
);

export default mongoose.models.Ticket || mongoose.model("Ticket", TicketSchema);