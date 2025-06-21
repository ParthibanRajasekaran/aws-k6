exports.handler = async (event) => {
  console.log("Lambda2 - ProcessData:", event);
  console.log("Received event:", JSON.stringify(event, null, 2));

  const processed = event.inputValue * 2;

  return {
    ...event,
    processedValue: processed,
    message: "Data processed",
  };
};
