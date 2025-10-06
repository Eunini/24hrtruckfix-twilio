import toolRegistry from "./index";
import AppointmentBookingTool from "./appointmentBooking";

/**
 * Register all tools with the tool registry
 * This is a convenience function to ensure all tools are properly registered
 */
export function registerAllTools() {
  // Register the appointment booking tool
  toolRegistry.registerTool({
    name: "Appointment_BookingTool",
    description: "Book an appointment with the funeral director",
    functionDeclaration: AppointmentBookingTool.getFunctionDeclaration(),
    execute: AppointmentBookingTool.execute,
  });

  // Add additional tool registrations here

  // Return the populated registry for convenience
  return toolRegistry;
}

export default registerAllTools;
