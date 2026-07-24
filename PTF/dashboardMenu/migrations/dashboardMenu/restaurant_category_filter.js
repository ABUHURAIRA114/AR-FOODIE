/**
 * restaurant_category_filter.js
 * ---------------------------------------------------------------------------
 * Django admin enhancement for the "Add/Change Dish" page.
 *
 * The Dish form has two fields:
 *   - #id_restaurant  A non-model field, purely for scoping this filter.
 *   - #id_category    The real FK saved on the Dish. Every <option> in it
 *                      carries data-restaurant-id="<pk>" (set server-side in
 *                      DishAdminForm / RestaurantScopedCategorySelect).
 *
 * This script hides every category <option> that doesn't belong to the
 * selected restaurant, so staff managing multiple restaurants can't
 * accidentally attach a dish to another restaurant's category. No AJAX is
 * needed — the full category list (with its restaurant tags) is already
 * rendered into the page; this only ever toggles visibility client-side.
 *
 * Runs once on page load (to correctly scope the category list when editing
 * an existing dish, where #id_restaurant is pre-filled) and again every time
 * #id_restaurant changes.
 */
(function () {
  "use strict";

  function filterCategories() {
    var restaurantSelect = document.getElementById("id_restaurant");
    var categorySelect = document.getElementById("id_category");
    if (!restaurantSelect || !categorySelect) return;

    var selectedRestaurantId = restaurantSelect.value;
    var options = categorySelect.querySelectorAll("option");
    var currentValueStillVisible = false;

    options.forEach(function (option) {
      // The blank "---------" option (if present) always stays visible.
      if (!option.value) {
        option.hidden = false;
        return;
      }

      var optionRestaurantId = option.getAttribute("data-restaurant-id");
      var matches = !selectedRestaurantId || optionRestaurantId === selectedRestaurantId;
      option.hidden = !matches;

      if (matches && option.selected) {
        currentValueStillVisible = true;
      }
    });

    // If the previously-selected category belongs to a different restaurant
    // than the one just chosen, clear it rather than silently keeping a
    // mismatched, now-hidden selection.
    if (selectedRestaurantId && categorySelect.value && !currentValueStillVisible) {
      categorySelect.value = "";
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    var restaurantSelect = document.getElementById("id_restaurant");
    if (!restaurantSelect) return;

    filterCategories();
    restaurantSelect.addEventListener("change", filterCategories);
  });
})();