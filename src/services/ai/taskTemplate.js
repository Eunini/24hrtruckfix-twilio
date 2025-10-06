const taskTemplates = {
    "ticket_created": [
      {
        title: "Find Service Provider for New Ticket",
        description: `A new service ticket has been created. Your immediate objective is to source a qualified Service Provider (SP). Begin searching all available sources starting with a $initial_search_radius from the breakdown location: $client_location. If no provider is found, expand the search radius by $search_expansion_increment and repeat the process until a 
        suitable SP is located. An automated confirmation email will be sent to the client immediately you assign an SP.`,
        tag: "Find SPs",
        aiAttempt: true 
      },
    ],
    "sp_assigned": [
      {
        title: "Dispatch Work Order to SP",
        description: `An SP has been confirmed for ticket $ticket_id. The system has sent an official Work Order to $sp_name. The work order was sent via all three required channels: 
        Email (to $sp_contact_email), SMS (to $sp_contact_phone), and the SP Portal. `,
        tag: "Generic",
      },
    ],
    "eta_expiry": [
      {
        title: "ETA Expired: Confirm SP Arrival",
        description: `The ETA of $eta_time for $sp_name has now passed. You must call both the SP (at $sp_contact_phone) and the customer (at $client_contact_phone) to confirm the SP has arrived at $client_location. Update the ticket with the result: 'SP Arrived', 'SP Delayed', or 'SP Assigned'(yet to show up/assigned new sp). If SP is delayed, ask them for a new ETA and update the ticket. If arrival is confirmed, remind the SP to take photos via the portal or text them to us.`,
        tag: "Generic",
      },
    ],
    "confirm_cadence": [
      {
        title: "Confirmation Cadence: Check Job Status",
        description: `The confirmation window for the service ($service_details) has passed. Call the customer at $client_contact_phone to confirm if $sp_name has completed the job and if it was executed successfully. Please also verify that the required post-job photos have been received from the SP. Record the final outcome in the ticket.`,
        tag: "Generic",
      },
    ],
    "request": [
      {
        title: "Service Provider Request To Ticket",
       description: "A service provider has submitted a new request for a ticket, providing the following service details: ($service_details), with an estimated arrival time of $eta, with a distance of $miles, and a total cost of $$total_cost. Please take a look",
       tag: "Modify Work Order",
      },
    ]
  // etc.
}

module.exports = taskTemplates;