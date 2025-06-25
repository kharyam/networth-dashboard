# Current development
* 


# More Manual support



## Crypto
The next thing I would like to do is add the ability to track crypto holdings. There should be a new page for Crypto, added to the sidebar navigation.  It will be manual now, but we'll add the ability to integrate with crypto account APIs (e.g., ledger live, coinbase, kraken pro) later. There should be a manual plugin to handle crypto account holdings.  Examples of information we need for each account is Institution Name, Crypto symbol, and current balance (number of tokens).  Add other fields you think are relevant. This plugin should be integrated using the same framework created for the other manual accounts. The crypto holdings converted to dollars will of course need to be added to total net-worth like everything else, and categorized in the pie chart on the dashboard page as "Crypto". Display total amount of crypto owned in dollars on the dashboard as well. Create relevant visualizations for the crypto page. Add ability to get current price of the crypto so we can compute its value in dollars.  Use a free api to retrieve crypto prices. Part of the visualization should allow us to see the currency price in dollars or in bitcoin. If the user wants to see the price history of the crypto, we should have the ability to either link to the graph on an external website or embed their graph from that website, as possible. Consdier investigating the use of widgets from coingecko to embed the graphs (https://www.coingecko.com/en/widgets).Similarly, there should be an option to see a graph of the cryptos price over time priced in bitcoin.  Again, we should link to an external site or embed the graph from an external site. Plan this all out in phases for my review. Make sure the UI interacts with the backend to retrieve the data it needs, and implement the appropriate backend APIs to do this.

## Cash holdings DONE
 The next thing I would like to do is add the ability to track cash holdings. There should probably be a new page for Cash, added to the sidebar navigation.  It will be manual now, but we'll add the ability to integrate with bank account APIs (e.g., Ally bank and Webster bank) later. There should be a manual plugin to handle bank account holdings.  Examples of information we need for each account is Institution Name, Bank account Name, account type (e.g., Savings, Checking), interest rate, current balance.  Add other fields you think are relevant. This plugin should be integrated using the same framework created for the other manaul accounts. The cash holdings will of course need to be added to total networth like everything else, and categorized in the pie chart on the dashboard page. Create relevant visualizations for this page.  One idea is a chart showing account growth over time based on the interest rate, using a user-provided monthly contribution to the account.  Plan this out and describe it to me.  The implementation should be robust, consistent with what we already have, and modular. 

Future visualizations
 7. Interactive Growth Calculator
  8. Savings Goals Progress
  9. Cash Flow Analysis



# Refactor exercise
* Analyze the entire application, identify areas that could be made more efficient and maintainable.  Check if there is redundant code that can be consolidated.  Make sure things are modular and can be understood by a developer or AI taking ownership of the project.  Make a list if recommended updates and changes to fix any of these shortcomings

# TODOs
* Replace mock price provider with real prices
* "Recent Activity" is showing fake data.  Devise a mechanism for putting the real activity here.  One way would be to have a database table that has an audit log of user actions, and this table can show a one line indication of the last things the user did.
* "Accounts" page has no content yet
* "Settings" page is empty.  What types of configuration settings will eventually go here?
* Get house zestimate with: https://freewebapi.com/data-apis/real-estate-api/