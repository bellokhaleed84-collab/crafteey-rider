import { connectToDatabase } from "@/lib/mongodb";
import Courier from "@/models/Courier";
import CourierRequest from "@/models/CourierRequest";

async function main() {
  await connectToDatabase();

  const couriers = await Courier.find({}).select("name vehicleType").lean();
  console.log("--- Couriers ---");
  couriers.forEach((c) =>
    console.log(`${c.name}: "${c.vehicleType}"`)
  );

  const requests = await CourierRequest.find({})
    .select("clientName vehicleType status")
    .lean();
  console.log("\n--- Courier Requests ---");
  requests.forEach((r) =>
    console.log(`${r.clientName} (${r.status}): "${r.vehicleType}"`)
  );

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});