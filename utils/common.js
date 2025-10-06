const axios = require('axios');
function filterEmptyAttribs(payload) {
  if (Object.keys(payload).length) {
    return Object.keys(payload).reduce((acc, current) => {
      if (payload[current] && payload[current]?.length) {
        acc[current] = payload[current];
      }

      return acc;
    }, {});
  }

  return payload;
}

async function onSubmitModelForm(request) {
  const todaysDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
  let apiSuccess = 0;

  const datetime = new Date();
  datetime.setMinutes(datetime.getMinutes() - datetime.getTimezoneOffset() + (-300)); // Adjust to America/New_York timezone (UTC-5)
  let minute = datetime.getMinutes();
  let diff = 10 - (minute % 10);
  
  // Adjust the datetime to the next 10-minute mark
  datetime.setMinutes(datetime.getMinutes() + diff);
  const endTime = datetime.toISOString().replace('T', ' ').slice(0, 19); // Format to "Y-m-d h:i:00"

  const data = {
    domain_name: "24hrtruckrepair-sas.tookan.in",
    access_token: "",
    vendor_id: "",
    is_multiple_tasks: 1,
    fleet_id: "",
    latitude: 0,
    longitude: 0,
    timezone: 300,
    has_pickup: 1,
    has_delivery: 0,
    pickup_delivery_relationship: 0,
    layout_type: 0,
    auto_assignment: 1,
    team_id: "",
    deliveries: [],
    pickups: [
      {
        address: request.location,
        name: request.name,
        job_description: 'DESC: ['+request.description+'] VEHICLE: ['+request.vehicle+'] LOCATION: ['+request.location+']',
        latitude: request.lat,
        longitude: request.lat,
        time: endTime,
        phone: request.phone,
        template_data: [
          {
            label: "subtotal",
            display_name: "subtotal",
            data_type: "Number",
            app_side: "2",
            required: 0,
            value: 0,
            data: null,
            input: null,
            template_id: "Template"
          },
          {
            label: "totalFare",
            display_name: "totalFare",
            data_type: "Number",
            app_side: "2",
            required: 0,
            value: 0,
            data: null,
            input: null,
            template_id: "Template"
          },
          {
            label: "Task_Details",
            display_name: "Task Details",
            data_type: "Text",
            app_side: "1",
            required: 0,
            value: 1,
            data: "",
            input: "",
            template_id: "Template"
          },
          {
            label: "paymentMethod",
            display_name: "paymentMethod",
            data_type: "Text",
            app_side: "2",
            required: 0,
            value: 0,
            data: "2",
            input: "2",
            template_id: "Template"
          },
          {
            label: "fleet_percent",
            display_name: "fleet percent",
            data_type: "Text",
            app_side: "2",
            required: 0,
            value: 0,
            data: "0.7",
            input: "0.7",
            template_id: "Template"
          },
          {
            label: "parts_fee",
            display_name: "parts fee",
            data_type: "Number",
            app_side: "1",
            required: 1,
            value: 1,
            data: 0,
            input: 0,
            template_id: "Template"
          },
          {
            label: "service_fee",
            display_name: "service fee",
            data_type: "Number",
            app_side: "1",
            required: 1,
            value: 1,
            data: 0,
            input: 0,
            template_id: "Template"
          },
          {
            label: "parts_percent",
            display_name: "parts percent",
            data_type: "Text",
            app_side: "2",
            required: 0,
            value: 0,
            data: "0.3",
            input: "0.3",
            template_id: "Template"
          },
          {
            label: "service_percent",
            display_name: "service percent",
            data_type: "Text",
            app_side: "2",
            required: 0,
            value: 0,
            data: "0.3",
            input: "0.3",
            template_id: "Template"
          }
        ],
        template_name: "Template",
        ref_images: ""
      }
    ]
  };

  try {
    const response = await axios.post('https://api.tookanapp.com/create_task_via_vendor_domain', data, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log(response.data, '-----------------------request repair response');
    return response.data;
  } catch (error) {
    console.error('Error occurred:', error.message);
    return null;
  }
}

module.exports = {
  filterEmptyAttribs, onSubmitModelForm
};
