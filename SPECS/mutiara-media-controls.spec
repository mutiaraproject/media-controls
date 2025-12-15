Name:           mutiara-media-controls
Version:        1.0.0
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
mkdir -p %{buildroot}/usr/share/gnome-shell/extensions/mediacontrols@mutiaraproject/
cp -r * %{buildroot}/usr/share/gnome-shell/extensions/mediacontrols@mutiaraproject/

%files
/usr/share/gnome-shell/extensions/mediacontrols@mutiaraproject/

%changelog
* Mon Dec 16 2025 Kara <kentang@outlook.it> - 1.0.0-1
- Initial COPR-ready package
