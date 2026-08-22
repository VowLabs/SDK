(function () {
  function mountUnitOnboarding(target) {
    if (!window.VowLabs?.Banking || typeof window.VowLabs.Banking.mountUnitOnboarding !== 'function') {
      return null;
    }
    return window.VowLabs.Banking.mountUnitOnboarding(target);
  }

  function boot() {
    var explicit = document.getElementById('BankingUnitOnboarding');
    if (explicit) mountUnitOnboarding(explicit);

    var nodes = document.querySelectorAll('[data-banking-unit-onboarding]');
    for (var i = 0; i < nodes.length; i++) {
      mountUnitOnboarding(nodes[i]);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
