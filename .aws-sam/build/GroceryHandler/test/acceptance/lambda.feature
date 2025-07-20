Feature: Grocery Lambda Direct Invocation

  Scenario: Store grocery list via Lambda
    * def lambda = Java.type('com.intuit.karate.lambda.LambdaInvoker')
    * def event = { items: ["apple", "banana"] }
    * def result = lambda.invoke('groceryHandler.handler', event)
    * match result.statusCode == 200
    * match result.body contains 'Grocery list stored'
