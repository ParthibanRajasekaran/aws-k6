Feature: Grocery Lambda Direct Invocation

  Background:
    * url 'http://localhost:3000'

  Scenario: Store grocery list via Lambda endpoint
    Given path 'grocery'
    And request { items: ["apple", "banana", "orange"] }
    When method post
    Then status 200
    And match response.message == 'Grocery list stored successfully'
    And match response.s3Key != null
