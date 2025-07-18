# Next Up

When I start with assets of 
Stocks 0
Crypto $258,521
Real Estate $818,133
Cash $32,557
Other 0
The first line of the scenario is completely wrong for the starting calculation 
Year	Net Worth (USD)	Net Worth (BTC)	BTC Price	Stocks	Crypto	Real Estate	Cash	Other
Current	$1,108,942	₿9.2166	$120,320	$0	$683,597	$409,067	$16,278	$0
house and cash are half the actual values, starting crypto way higher than actual starting value

The pages navigation on the left hand side is getting pretty long.  Is there a way to organize these more logically and maybe nest / group them? The summary cards on the top of the page should also navigate to the corresponding page when they are clicked by the user.

I want a tab that allows me to perfrom what-if scenarios for future net worth.  I should be able to specify a time range, expected returns on each asset class (provide suggested values based on current information on performance (e.g., apr on cash accounts), expected growth of bitcoin and other crypto holdings per year, etc.  As a result, show the price of the portfolio in us dollars (with details on each asset class) and also the option to show the portfolio value in terms of bitcoin, for the expected price of bitcoin at the time the what-if scenario ends. Also provide the abilitiy to export pdf or html reports of the forecast (all html artifacts / graphics / css / in a zip file).  Let me know any other features you could add that would be valuable.  The goal is not only to estimate how the portfolio will grow, but to show how moving assets into bitcoin could potentially affect the overall worth in the future.  When creating the future project, the user should be able to specify what percentage to move to bitcoin before running the project scenario.  Also suggest any other features that could be valuable.  Optionally, there should be the ability to save each scenario with a name, and apply it to the current net worth of the user after they'v updated the values in their portfolio. 


IN PROGRESS I have an ambitious plan to update this application. I would like the application to have the ability to integrate with an llm via an open api compatible endpoint.  Possibly create a chat interface in the application, geared towards this application, for interaction with the user.  The main feature I want, is the ability for the application to analyze an arbitrary statement (text,pdf,csv,etc.) from a financial institution and use the existing api (or database directly, prefereably API) to update all relevant financial information in the dashboard.  If the statement is from a bank, update all matching bank accounts or creat them if they don't exist with information from the statement.  For a brokerage account, do the same, adding each holding as an entry for the institution. Possibly look up what the current dividend is for the holding and add that as well, since we are tracking it.  I imagine to do this, a fairly sophisticated prompt has to be given to the LLM through the endpoint to let it know exactly how to transform arbitrary statements so that they can be added to the dashboard via the existing API.  The code will then need to get the standardized output from the llm (which it will match a format given to it from its prompt) and make all appropriate calls to update the dashboard.  For matching entries from the statement, it should update existing information, otherwise create new entries. Create a plan for this, let me know the feasibility of doing it, and what technologies would be used to integrate the llm input/output with the functionality of the dashboard, such as API integration.

Check all the code for usages of account_id that should be removed and fix them. Check for any code that is deprecated and update appropriately.

Investigate updating the code so that it can detect if the ai connection is using ollama, and if so, create a wrapper layer to support ollama without needing to update any other code (compatibility layer between openai api and ollama api).  Log which endpoint type was detected and being used.



DONE Need a way of specifying a brokerage account, right now its under cash holdings

DONE For cash holdings, a bulk edit screen would be helpful.  For each institution, a table view similar to a spreadsheet where I can update values at once then submit them in bulk. Describe a good way to add this functionality to the UI, e.g., what the UI enhancements would look like.

DONE The stocks page has no way to enter new stock holdings.

DONE The list view under real estate portfolio shows nothing valuable (null values). Fix this view to show valuable information for each property.



DONE The real estate price estimate feature is causing more trouble than it is worth. Can you add a feature flag to turn this off and just use manual updates for now?  This feature should be turned of by default until we revisit it again in the future.

DONE Get this error when editing a property from the real estate page validation failed: [{rental_income_monthly rental_income_monthly must be a valid number invalid_number}] On the manual entries page for real estate, when I edit, several fields are blank.  They are filled in on the real estate page when I hit edit.  Fix these inconsistencies

DONE  Stock value is only showing the opening price of the stock, it is never updating. Can you check the caching strategy for the stocks and see why it never seems to update (Even after clicking refresh to update prices)

DONE This "works", but now the cache serves no purpose, so this is really dumb.  Please create rules that make sense for when the cache should actually be used.

- Add swagger UI
DONE Create a swagger UI page accessible from the backend for all API endpoints. Could it be automated so as not to be manually coded, to the best degree possible? Can a link to the backend API be added to the frontend UI, or even better an "API" page in the sidebar and display the swagger page embedded within  the main area for the API page.  If it can be done easily, style the swagger page to match the styling of the appliction.  If it over complicates things, don't restyle it. It would be nice if it could be viewed in dark/light mode to match the main UI, but this isn't necessary. On The API page, if there is any other related API info that could be placed here (like health of the backend as an example) then put it here also. Analyze the code to make sure all API endpoints are added to swagger and add extra documentation to describe the purpose of the endpoints in the swagger documentation. On the API page, if you could have a link to download the openapi spec for import into tools, that would great also.

DONE On the API Health status panel, place the four status indicator panels on the same row to take up less vertical space on this page

DONE on the crypto holdings portfolio distribution pie chart, if a token is held at multiple institutions, they aren't aggregated.  For instance I see two slices of the pie for BTC, but it should be one slice with the combined valued.

DONE On the Crypto holdings page, instead of having a card for each holding, have a card for each unique institution.  On each card, show the cryptos for that organization with the same info as before and ability to toggle between usd and btc.  The toggle should affect all balances on the card at once, so only one togle on the card. A small pie chart on each card as well that shows the amount of each crypto type in the institution.

DONE IN PROGRESS Revisit Manual Stock
Right now the manual entry for stock is from Computer Share.  In reality, this type of manual entry should support any institution.  Accomplish this by renaming this type of entry with a generic name like "Stock Holding" and add a field with the institution name.   The stock page should have a pie chart that shows stock holdings (in dollars) by institution.  The vested equity stock holdings should be a slice in that pie chart as well. Do a deep investigation of the code to see all places that need to be updat


DONE When editing morgan stanley on manual entries, I can't set vested shares to 0.  Also I get an error if I do set it to a value greater than 0, and it does not save. 



DONE When I type something in the filter under manual entries, the list does not filter down as it should, it shows all entries even though it indicates fewer entries match (e.g., "5 of 14 entries") 

DONE Other Assets
* Add another page for "other assets" for things like cars, jewelry, etc. where you can have fields for estimated value and amount owed and purchase price. Is that the point of the miscellaneous_assets table? The type of asset should be in a dropdown.  There should be a way to update the possible asset types (categories) of assets, store this in a database table. Can you create a simple / elegant way such that each asset type could potentially have custom features?  For example, for a "Car", we might want to allow additional fields like make, model, mileage and condition so we can reach out to an API to get estimated value.  This extended ability should be an option for all asset types, so we need a good, maintainable framework to enable this extensibility. Each asset should have the option of having its own visualization page to support its custom features - again, this should be implemented in a modular / pluggable way for simplified extensibility. Make sure the swagger documentation is updated for the newly added API endpoints. This doesn't need to be integrated with manual entries, it can be fully managed from the other assets page. Give me other potential ideas for this page as well as you see fit.


DONE When I force refresh the stock price, it is not updating and looks like it is still pulling price from the cache.
Also give some type of visual confirmation of what stocks were loaded from the api and the prices that were fetched. Show how much the price went up or down since the last price in the cache. Continue with this as well as the other items in your todo list.  

- Refactor exercise
DONE Analyze the entire application, identify areas that could be made more efficient and maintainable.  Check if there is redundant code that can be consolidated.  Make sure things are modular and can be understood by a developer or AI taking ownership of the project.  Make a list of recommended updates and changes to address any of these shortcomings.  The preference should be to lessen the overall amount of code and make it more readable and understandable overall - more maintainable and extendable to allow new features to be easily added.

- Unit Tests
...

- Helm Chart
DONE Create a helm chart that can deploy the application (frontend, backend and postgres database) to OpenShift.  It should create ingress objects for exposing the frontend and backend. The frontend should be configured to use the hostname of the backend ingress for its api calls.  Implement any CORS configuration that may be needed so that the frontend and backend can talk properly. Don't create any openshift specific features, it should work in kubernetes as well. Create the appropriate configuration items in the values.yml, including the items from the env file as parameters.  Sensitive things, like API keys, should be added to a secret. There should be a separate values file for secret information, document that this should never be added to version control. Define the helm chart under a "helm" directory, organize it as you see fit, make it highly maintainable and easy to understand. If you can use an existing helm chart as a dependency to deploy postgres, do that. Make sure a persistent volume claim is created for postgres storage, and we have the ability to specify storage size in the values (with a reasonable default in values.yaml).  We should also be able to specify cpu/memory requests and limtis for each pod, choose reasonable defaults for each.

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



DONE The next thing I would like to do is add the ability to track cash holdings. There should probably be a new page for Cash, added to the sidebar navigation.  It will be manual now, but we'll add the ability to integrate with bank account APIs (e.g., Ally bank and Webster bank) later. There should be a manual plugin to handle bank account holdings.  Examples of information we need for each account is Institution Name, Bank account Name, account type (e.g., Savings, Checking), interest rate, current balance.  Add other fields you think are relevant. This plugin should be integrated using the same framework created for the other manaul accounts. The cash holdings will of course need to be added to total networth like everything else, and categorized in the pie chart on the dashboard page. Create relevant visualizations for this page.  One idea is a chart showing account growth over time based on the interest rate, using a user-provided monthly contribution to the account.  Plan this out and describe it to me.  The implementation should be robust, consistent with what we already have, and modular. 

Future visualizations
 7. Interactive Growth Calculator
  8. Savings Goals Progress
  9. Cash Flow Analysis


- DONE Add new fields in real estate for city, state and zip - we assume united states. The existing name should be the property address. Get house zestimate with: https://freewebapi.com/data-apis/real-estate-api/  or some other service that can retrieve a house price estimate based on address for free. Give me a plan

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
- These tables are currently empty - are there any plans for these or should they be deleted? manual_entries manual_entries_id_seq manual_entry_log manual_entry_log_id_seq 
