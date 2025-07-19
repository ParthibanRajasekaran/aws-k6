Feature: Grocery API via API Gateway

  Scenario: Store grocery list via API Gateway
    Given url 'http://localhost:3000/grocery'
    And request { items: ["apple", "banana"] }
    When method POST
    Then status 200
    And match response.message == 'Grocery list stored'
    And match response.s3Key contains 'grocery-list-'
