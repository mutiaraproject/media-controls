Name:           mutiara-media-controls
Version:        1.0.4
Release:        1%{?dist}
Summary:        Mutiara Media Controls GNOME extension

License:        MIT
URL:            https://github.com/mutiaraproject/media-controls
Source0:        %{name}-%{version}.tar.gz

BuildArch:      noarch
Requires:       gnome-shell, jq

%description
A GNOME extension to show media controls in the panel.

%prep
%setup -q -n src

%build
# nothing to compile

%install
mkdir -p %{buildroot}/usr/share/gnome-shell/extensions/mediacontrols@mutiaraproject.github.com/
cp -r * %{buildroot}/usr/share/gnome-shell/extensions/mediacontrols@mutiaraproject.github.com/

%files
/usr/share/gnome-shell/extensions/mediacontrols@mutiaraproject.github.com/

%changelog
* Mon Dec 16 2025 Kara <kentang@outlook.it> - 1.0.0-1
- Initial COPR-ready package

* Moon Dec 16 2025 Kara <kentang@outlook.it> - 1.0.3-1
- fixed naming problems
- started writing changelogs

* Mon Dec 16 2025 Kara <kentang@outlook.it> - 1.0.4-1
- whoops i kind of forgor to RENAME the damn thing
