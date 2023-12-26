const mongoose = require("mongoose");
const { Schema } = mongoose;

const BookingSchema = new Schema({
  booker: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  place: { type: mongoose.Schema.Types.ObjectId, ref: "Place", required: true },
  checkInDate: { type: Date, required: true },
  checkOutDate: { type: Date, required: true },
  guests: { type: Number, required: true },
  total: { type: Number, required: true },
});

const BookingModel = mongoose.model("Booking", BookingSchema);
module.exports = BookingModel;
