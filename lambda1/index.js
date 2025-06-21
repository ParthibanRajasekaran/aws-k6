exports.handler = async (event) => {
  console.log("Lambda1 - ValidateInput:", event);

  if (!event.inputValue || typeof event.inputValue !== "number") {
    throw new Error("Invalid input: inputValue must be a number");
  }

  return {
    ...event,
    validated: true,
    message: "Input validated",
  };
};
