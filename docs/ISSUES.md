# Current development
* 


# More Manual support

## Cash holdings
* Should be able to put in the institution name, account name, type of account (checking, savings)
* 
* Crypto
  * Add ability to get current price of the crypto
  * Show the price of the crypto in us dollars and its price in bitcoin
  * If the user wants to see the price history of the crypto, we should have the ability to either link to the graph on an external website ure use an embedded graph from that website, as possible 

# Refactor exercise
* Analyze the entire application, identify areas that could be made more efficient and maintainable.  Check if there is redundant code that can be consolidated.  Make sure things are modular and can be understood by a developer or AI taking ownership of the project.  Make a list if recommended updates and changes to fix any of these shortcomings

# TODOs
* "Recent Activity" is showing fake data.  Devise a mechanism for putting the real activity here.  One way would be to have a database table that has an audit log of user actions, and this table can show a one line indication of the last things the user did.
* "Accounts" page has no content yet
* "Settings" page is empty.  What types of configuration settings will eventually go here?
* Get house zestimate with: https://freewebapi.com/data-apis/real-estate-api/