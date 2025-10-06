import fetch from "node-fetch";

// Test the new /ask endpoint
async function testAskEndpoint() {
  const question = "List 100 mechanics in the system";

  try {
    console.log("🤖 Asking question:", question);

    const response = await fetch("http://localhost:3000/ask", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question: question,
        model: "gpt-4o-mini", // optional
      }),
    });

    const result = await response.json();

    if (result.success) {
      console.log("✅ Success!");
      console.log("Question:", result.question);
      console.log("Output:", result.output_text);
      console.log("Timestamp:", result.timestamp);
    } else {
      console.log("❌ Error:", result.error);
      console.log("Message:", result.message);
    }
  } catch (error) {
    console.error("❌ Request failed:", error.message);
  }
}

// Run the test
testAskEndpoint();
