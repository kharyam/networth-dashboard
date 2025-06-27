# Next Up

DONE The real estate price estimate feature is causing more trouble than it is worth. Can you add a feature flag to turn this off and just use manual updates for now?  This feature should be turned of by default until we revisit it again in the future.

DONE Get this error when editing a property from the real estate page validation failed: [{rental_income_monthly rental_income_monthly must be a valid number invalid_number}] On the manual entries page for real estate, when I edit, several fields are blank.  They are filled in on the real estate page when I hit edit.  Fix these inconsistencies

Stock value is only showing the opening price of the stock, it is never updating. Can you check the caching strategy for the stocks and see why it never seems to update?

- Add swagger UI
Would you be able to create a swagger UI page accessible from the backend for all API endpoints? Could it be automated so as not to be manually coded? Can a link to the backend API be added to the frontend UI, perhaps as a page in the sidebar and display it embeded in the main area.  If it can be done easily, style the swagger page to match the styling of the appliction.  If it over complicates things (e.g., need to support dark /light mode), don't restyle it.

- Look at the quick actions on the dashboard that are not implemented. Implement the ones that you can now. Make sure these still make sense.  For future ones, create a popup to let the user know the feature isn't implemented yet.

- Other Assets
* Another page for "other assets" for things like cars, jewelry, etc. where you can have fields for estimated value and amount owed and purchase price? Is that the point of the miscellaneous_assets table? The type of asset should be in a dropdown.  There should be a way to update the possible asset types (categories) of assets, store this in a database table. Can you create a simple / elegant way such that each asset type could potentially have custom features?  For example, for a "Car", we might want to allow additional fields like make, model, mileage and condition so we can reach out to an API to get estimated value.  This extended ability should be an option for all asset types, so we need a good, maintainable framework to enable this extensibility. Each asset should have the option of having its own visualization page to support its custom features - again, this should be implemented in a modular / pluggable way for simplified extensibility. 

- Refactor exercise
* Analyze the entire application, identify areas that could be made more efficient and maintainable.  Check if there is redundant code that can be consolidated.  Make sure things are modular and can be understood by a developer or AI taking ownership of the project.  Make a list of recommended updates and changes to address any of these shortcomings.  The preference should be to lessen the overall amount of code and make it more readable and understandable overall - more maintainable and extendable to allow new features to be easily added.

- Helm Chart
Create a helm chart that can deploy the application (frontend, backend and postgres database) to OpenShift.  It should create ingress objects for exposing the frontend and backend. The frontend should be configured to use the hostname of the backend ingress for its api calls.  Implement any CORS configuration that may be needed so that the frontend and backend can talk properly. Don't create any openshift specific features, it should work in kubernetes as well. Create the appropriate configuration items in the values.yml, including the items from the env file as parameters.  Sensitive things, like API keys, should be added to a secret. There should be a separate values file for secret information, document that this should never be added to version control. Define the helm chart under a "helm" directory, organize it as you see fit, make it highly maintainable and easy to understand. If you can use an existing helm chart as a dependency to deploy postgres, do that. Make sure a persistent volume claim is created for postgres storage, and we have the ability to specify storage size in the values (with a reasonable default in values.yaml)

At this point, we should be able to plan the implementation of prompt 3

# Done

## Crypto
DONE The next thing I would like to do is add the ability to track crypto holdings. There should be a new page for Crypto, added to the sidebar navigation.  It will be manual now, but we'll add the ability to integrate with crypto account APIs (e.g., ledger live, coinbase, kraken pro) later. There should be a manual plugin to handle crypto account holdings.  Examples of information we need for each account is Institution Name, Crypto symbol, and current balance (number of tokens).  Add other fields you think are relevant. This plugin should be integrated using the same framework created for the other manual accounts. The crypto holdings converted to dollars will of course need to be added to total net-worth like everything else, and categorized in the pie chart on the dashboard page as "Crypto". There should be a top level display on the dashboard showing total crypto holdings, just like all the other asset classes.  Create relevant visualizations for the crypto page. Add ability to get current price of the crypto so we can compute its value in dollars.  Use a free api to retrieve crypto prices, like coingecko. Part of the visualization should allow us to see the currency price in dollars or in bitcoin. If the user wants to see the price history of the crypto, we should have the ability to either link to the graph on an external website or embed a graph from that website, as possible. Consdier investigating the use of widgets from coingecko to embed these graphs (https://www.coingecko.com/en/widgets).Similarly, there should be an option to see a graph of the cryptos price over time priced in bitcoin.  Again, we should link to an external site or embed the graph from an external site. Plan this all out in phases for my review. Make sure the UI interacts with the backend to retrieve the data it needs, and implement the appropriate backend APIs to do this. Use the same patterns we have used to this point, maintain modularity, don't duplicate code if it can be avoided. Plan this in phases, and show me the phases.

DONE Cryptos are not showing up on manual entries page. The 7 summary cards on the dashboard, distribute them across 2 rows.  Find away to make total net worth more prominent, since it is the most important one. On the crypto page showing the pie charts - can the pie charts update to show value in bitcoin in the mouse-overs when the usd/btc toggle is pressed in the header?

DONE The crypto is still not showing in manual entries.  Make sure you updated getManualEntries so that it constructs entries from the relevant crypto table in the database.  Make related changes to get this working properly.

DONE On the Crypto Holdings page, show the total portfolio value in usd or btc depending on the state of the usd/btc toggle at the top of the page.

DONE Maybe add a friendly name for each plugin instead of mapping plugin.name to a friendly name.  Define the friendly name in each plugin and remove the conditional logic to just use the friendly name. Is this better than the current approach?

DONE It looks like the crypto price history is kept in a database table. Create a chart that shows the price history of all cryptos in there for "cached crypto prices history".  There should be a disclaimer that this information is based on "random" snapshots taken over the lifecylce of the application.  Should have the option to show the price in USD or BTC (link this to the toggle at the top of the screen, if it already exists)

DONE On the crypto price history graph, the lines for each crypto are disconnected.  Can they be made continuous? I would have expected this to be default behaviour of the line chart?


## Cash holdings DONE
 The next thing I would like to do is add the ability to track cash holdings. There should probably be a new page for Cash, added to the sidebar navigation.  It will be manual now, but we'll add the ability to integrate with bank account APIs (e.g., Ally bank and Webster bank) later. There should be a manual plugin to handle bank account holdings.  Examples of information we need for each account is Institution Name, Bank account Name, account type (e.g., Savings, Checking), interest rate, current balance.  Add other fields you think are relevant. This plugin should be integrated using the same framework created for the other manaul accounts. The cash holdings will of course need to be added to total networth like everything else, and categorized in the pie chart on the dashboard page. Create relevant visualizations for this page.  One idea is a chart showing account growth over time based on the interest rate, using a user-provided monthly contribution to the account.  Plan this out and describe it to me.  The implementation should be robust, consistent with what we already have, and modular. 

Future visualizations
 7. Interactive Growth Calculator
  8. Savings Goals Progress
  9. Cash Flow Analysis


# STUCK
- [IN PROGRESS] Add new fields in real estate for city, state and zip - we assume united states. The existing name should be the property address. Get house zestimate with: https://freewebapi.com/data-apis/real-estate-api/  or some other service that can retrieve a house price estimate based on address for free. Give me a plan

When editing real estate on real estate page, there was an error and it failed to save.  It also did not accept an unset lot size, but it should.

```
Implementation Plan for Zillow Integration:
1. Research Zillow API endpoints and authentication
2. Create new ZillowValuationProvider class (similar to ATTOM Data)
3. Update PropertyValuationService to include Zillow as primary provider
4. Add Zillow API configuration to environment variables
5. Test integration with sample addresses
6. Update frontend to show provider source in UI    
```


# TODOs
* DONE Consolidated holdings does not seem to aggregate/include vested stock from equity compensation
* DONE Replace mock price provider with real prices from a free stock API. Cache values to prevent too many calls to the API
* "Recent Activity" is showing fake data.  Devise a mechanism for putting the real activity here.  One way would be to have a database table that has an audit log of user actions, and this table can show a one line indication of the last things the user did.
* "Accounts" page has no content yet
* "Settings" page is empty.  What types of configuration settings will eventually go here?

# Future
Multi user support. Create a demo user with realistc fake data (Insert realistic fake data for a user into the DB tables as part of initialization)
