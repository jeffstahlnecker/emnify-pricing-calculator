import { useLoaderData } from "@remix-run/react";
import { useState } from "react";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/react/20/solid";
import { Combobox, Switch } from "@headlessui/react";

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

export const loader = async () => {
  const getSortedTariffsPlus = async (currencyId) => {
    let sortedTariffs = [];
    await fetch("https://cdn.emnify.net/api/v1/public/tariff")
      .then((response) => response.json())
      .then((data) => {
        for (let i = 0; i < data.length; i++) {
          if (data[i].currency.id === currencyId && data[i].status.id == 1) {
            sortedTariffs.push(data[i]);
          }
        }
      });

    return sortedTariffs;
  };

  const eurRatTariff = await getSortedTariffsPlus(1);
  const usdRatTariff = await getSortedTariffsPlus(2);

  const getRateTariff = async (tariffs) => {
    let ratezones = [];
    const setTariffs = tariffs;
    for (let i = 0; i < tariffs.length; i++) {
      await fetch(
        `https://cdn.emnify.net/api/v1/public/tariff/${tariffs[i].id}/ratezone`
      )
        .then((response) => response.json())
        .then((data) => {
          setTariffs[i].ratezones = data;
          for (let j = 0; j < data.length; j++) {
            if (data[j].main_zone === true) {
              ratezones.push(data[j]);
            }
          }
        });
    }
    return { tariffs: setTariffs, ratezones: ratezones };
  };

  const updatedRatezones = [
    (await getRateTariff(eurRatTariff)).ratezones,
    (await getRateTariff(usdRatTariff)).ratezones,
  ];

  const getAllAvailableCountries = async (ratezonesObjectArray) => {
    let countries = [];
    ratezonesObjectArray.map((currency) => {
      return currency.map((ratezone) => {
        return ratezone.coverage.map((provider) => {
          const formatCountries = {
            id: provider.country.id,
            name: provider.country.name,
          };
          countries.push(formatCountries);
        });
      });
    });
    const uniqueCountries = Array.from(new Set(countries.map((a) => a.id))).map(
      (id) => {
        return countries.find((a) => a.id === id);
      }
    );
    uniqueCountries.sort((a, b) =>
      a.name > b.name ? 1 : b.name > a.name ? -1 : 0
    );

    return uniqueCountries;
  };

  const availableCountries = await getAllAvailableCountries(updatedRatezones);

  const pricingData = {
    countries: availableCountries,
    usd: usdRatTariff,
    eur: eurRatTariff,
  };

  return pricingData;
};

export default function Index() {
  const pricing = useLoaderData();
  const { countries } = pricing;
  const [query, setQuery] = useState("");
  const [selectedCountries, setSelectedCountries] = useState([]);
  const [selectedCurrency, setSelectedCurrency] = useState(1);
  const [enabled, setEnabled] = useState(false);
  const [calculatedPricing, setCalculatedPricing] = useState({
    data: 0,
    smsMo: 0,
  });

  const tariff = selectedCurrency === 1 ? pricing.eur : pricing.usd;

  const getPricing = (countries) => {
    const collectedData = [];
    tariff.forEach((tariff) => {
      const tariffId = tariff.id;
      const { ratezones } = tariff;
      ratezones.forEach((ratezone) => {
        const ratezoneId = ratezone.id;

        let dataRate = null;
        let smsmoRate = null;
        ratezone.rate.forEach((rate) => {
          if (rate.service.id === 38) {
            dataRate = rate.rate;
          } else {
            smsmoRate = rate.rate;
          }
        });

        const { coverage } = ratezone;
        coverage.forEach((provider) => {
          const { country } = provider;

          for (let i = 0; i < countries.length; i++) {
            console.log(country.id);
            console.log(countries[i].id);
            if (country.id === countries[i].id) {
              collectedData.push({
                country: countries[i],
                tariff: tariffId,
                ratezone: ratezoneId,
                data: dataRate,
                smsMo: smsmoRate,
              });
            }
          }
        });
      });
    });

    const organized = {};

    // organize values under ratezones
    for (let i = 0; i < collectedData.length; i++) {
      organized[collectedData[i].ratezone] = {
        countries: [],
        tariff: collectedData[i].tariff,
      };
    }
    for (let i = 0; i < collectedData.length; i++) {
      if (
        !organized[collectedData[i].ratezone].countries.includes(
          collectedData[i].country
        )
      ) {
        organized[collectedData[i].ratezone].countries.push(
          collectedData[i].country
        );
      }
    }

    // create array of ratezones that only have all countries

    let reducedArray = [600];

    for (let i = 0; i < collectedData.length; i++) {
      if (
        organized[collectedData[i].ratezone].countries.length ===
        countries.length
      ) {
        reducedArray.push(collectedData[i]);
      }
    }

    // find the zone with lowest price for each country

    const check = reducedArray.reduce(function (prev, curr) {
      return prev.Cost < curr.Cost ? prev : curr;
    });

    let pricing = {
      data: check.data,
      smsMo: check.smsMo,
    };
    return pricing;
  };

  const addCountryHandler = (countryObject) => {
    if (selectedCountries.includes(countryObject)) {
      return;
    }
    const currentSelectedCountries = [...selectedCountries];
    currentSelectedCountries.push(countryObject);
    setSelectedCountries(currentSelectedCountries);
  };

  const removeCountryHandler = (countryObject) => {
    if (!selectedCountries.includes(countryObject)) {
      return;
    }
    const currentSelectedCountries = [...selectedCountries];
    const indexOfObject = currentSelectedCountries.indexOf(countryObject);
    if (indexOfObject > -1) {
      currentSelectedCountries.splice(indexOfObject, 1);
      setSelectedCountries(currentSelectedCountries);
    }
  };

  const filteredCountries =
    query === ""
      ? countries
      : countries.filter((country) => {
          return country.name.toLowerCase().includes(query.toLowerCase());
        });

  console.log("rendering...");

  return (
    <div className="px-4 mx-auto max-w-7xl sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <Switch
          checked={enabled}
          onChange={(e) => {
            setEnabled(e);
            enabled ? setSelectedCurrency(1) : setSelectedCurrency(2);
          }}
          className={classNames(
            enabled ? "bg-indigo-600" : "bg-gray-200",
            "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          )}
        >
          <span className="sr-only">Use setting</span>
          <span
            className={classNames(
              enabled ? "translate-x-5" : "translate-x-0",
              "pointer-events-none relative inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
            )}
          >
            <span
              className={classNames(
                enabled
                  ? "opacity-0 ease-out duration-100"
                  : "opacity-100 ease-in duration-200",
                "absolute inset-0 flex h-full w-full items-center justify-center transition-opacity"
              )}
              aria-hidden="true"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-6 h-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </span>
            <span
              className={classNames(
                enabled
                  ? "opacity-100 ease-in duration-200"
                  : "opacity-0 ease-out duration-100",
                "absolute inset-0 flex h-full w-full items-center justify-center transition-opacity"
              )}
              aria-hidden="true"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-6 h-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14.25 7.756a4.5 4.5 0 100 8.488M7.5 10.5h5.25m-5.25 3h5.25M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </span>
          </span>
        </Switch>

        <Combobox
          as="div"
          value={selectedCountries.map((country) => {
            return <p key={country?.id}>{country?.name}</p>;
          })}
          onChange={(e) => addCountryHandler(e)}
        >
          <Combobox.Label className="block text-sm font-medium text-gray-700">
            Which countries will one device travel to?
          </Combobox.Label>
          <div className="relative mt-1">
            <Combobox.Input
              className="w-full py-2 pl-3 pr-10 bg-white border border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
              onChange={(event) => setQuery(event.target.value)}
              displayValue={(country) => country?.name}
            />
            <Combobox.Button className="absolute inset-y-0 right-0 flex items-center px-2 rounded-r-md focus:outline-none">
              <ChevronUpDownIcon
                className="w-5 h-5 text-gray-400"
                aria-hidden="true"
              />
            </Combobox.Button>

            {filteredCountries.length > 0 && (
              <Combobox.Options className="absolute z-10 w-full py-1 mt-1 overflow-auto text-base bg-white rounded-md shadow-lg max-h-60 ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                {filteredCountries.map((country) => (
                  <Combobox.Option
                    key={country.id}
                    value={country}
                    className={({ active }) =>
                      classNames(
                        "relative cursor-default select-none py-2 pl-8 pr-4",
                        active ? "bg-indigo-600 text-white" : "text-gray-900"
                      )
                    }
                  >
                    {({ active, selected }) => (
                      <>
                        <span
                          className={classNames(
                            "block truncate",
                            selected && "font-semibold"
                          )}
                        >
                          {country.name}
                        </span>

                        {selected && (
                          <span
                            className={classNames(
                              "absolute inset-y-0 left-0 flex items-center pl-1.5",
                              active ? "text-white" : "text-indigo-600"
                            )}
                          >
                            <CheckIcon className="w-5 h-5" aria-hidden="true" />
                          </span>
                        )}
                      </>
                    )}
                  </Combobox.Option>
                ))}
              </Combobox.Options>
            )}
          </div>
        </Combobox>
        <div>
          Selected Countries:
          {selectedCountries.map((country) => {
            return (
              <span
                key={country.name}
                className="inline-flex items-center rounded-full bg-indigo-100 py-0.5 pl-2.5 pr-1 text-sm font-medium text-indigo-700"
              >
                {country.name}
                <button
                  type="button"
                  className="ml-0.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-indigo-400 hover:bg-indigo-200 hover:text-indigo-500 focus:bg-indigo-500 focus:text-white focus:outline-none"
                  onClick={() => {
                    removeCountryHandler(country);
                  }}
                >
                  <span className="sr-only">Remove large option</span>
                  <svg
                    className="w-2 h-2"
                    stroke="currentColor"
                    fill="none"
                    viewBox="0 0 8 8"
                  >
                    <path
                      strokeLinecap="round"
                      strokeWidth="1.5"
                      d="M1 1l6 6m0-6L1 7"
                    />
                  </svg>
                </button>
              </span>
            );
          })}
        </div>
        <br />
        <div>
          <button
            className="px-4 py-2 font-bold text-white bg-blue-500 rounded hover:bg-blue-700"
            onClick={() => setCalculatedPricing(getPricing(selectedCountries))}
          >
            Get Pricing
          </button>
        </div>
        <br />
        <div>
          <h2 className="font-bold">Pay-As-You-Go</h2>
          <p>Data (per MB): {calculatedPricing.data}</p>
          <p>Outbound SMS: {calculatedPricing.smsMo}</p>
        </div>
      </div>
    </div>
  );
}
